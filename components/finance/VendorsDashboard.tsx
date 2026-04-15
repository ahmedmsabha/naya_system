'use client';

import Link from 'next/link';
import { useMemo, useRef, useState, useTransition } from 'react';
import {
  ArrowUpRight,
  Building2,
  CalendarClock,
  Download,
  Eye,
  Loader2,
  Plus,
  Receipt,
  ReceiptText,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { Area, AreaChart, ResponsiveContainer } from 'recharts';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import {
  VENDOR_PAYABLE_CATEGORIES,
  type VendorPayableCategory,
} from '@/lib/finance/monthly-pnl';
import {
  addVendorInvoiceAction,
  attachVendorInvoiceReceiptAction,
  deleteVendorInvoiceAction,
  getVendorSmartAnalysisAction,
} from '@/app/(dashboard)/branch/[id]/vendors/actions';
import {
  VendorSmartAnalysis,
  type VendorSmartAnalysisData,
} from '@/components/finance/VendorSmartAnalysis';
import { exportVendorReportPDF } from '@/lib/finance/VendorReportPDF';

type VendorInvoiceRow = {
  id: string;
  vendorName: VendorPayableCategory;
  invoiceDate: string;
  amount: number;
  receiptUrl: string | null;
  createdAt: string;
};

type VendorTrendPoint = {
  period: string;
  label: string;
  total: number;
};

type SmartStatus = 'Under Budget' | 'Trend Rising' | 'Critical Increase';

type VendorsDashboardProps = {
  branchId: string;
  branchName: string;
  selectedPeriod: string;
  monthLabel: string;
  initialInvoices: VendorInvoiceRow[];
  initialMonthlyTotals: Record<VendorPayableCategory, number>;
  trendSeriesByVendor: Record<VendorPayableCategory, VendorTrendPoint[]>;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(isoDate: string): string {
  const date = new Date(`${isoDate}T12:00:00`);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function parseAmount(value: string): number {
  const normalized = value.trim().replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

function periodStart(period: string): string {
  return `${period}-01`;
}

function periodEnd(period: string): string {
  const d = new Date(`${period}-01T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return `${period}-${String(d.getDate()).padStart(2, '0')}`;
}

function getSmartStatus(current: number, previous: number): SmartStatus {
  if (previous <= 0) return current > 0 ? 'Trend Rising' : 'Under Budget';
  const changePct = ((current - previous) / previous) * 100;
  if (changePct >= 15) return 'Critical Increase';
  if (changePct > 0) return 'Trend Rising';
  return 'Under Budget';
}

function getStatusStyle(status: SmartStatus): string {
  if (status === 'Under Budget') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (status === 'Trend Rising') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-rose-200 bg-rose-50 text-rose-700';
}

export function VendorsDashboard({
  branchId,
  branchName,
  selectedPeriod,
  monthLabel,
  initialInvoices,
  initialMonthlyTotals,
  trendSeriesByVendor,
}: VendorsDashboardProps) {
  const [invoices, setInvoices] = useState<VendorInvoiceRow[]>(initialInvoices);
  const [activeVendor, setActiveVendor] = useState<VendorPayableCategory | null>(null);
  const [amountInput, setAmountInput] = useState('');
  const [invoiceDateInput, setInvoiceDateInput] = useState(periodStart(selectedPeriod));
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isSubmittingInvoice, startSubmitTransition] = useTransition();
  const [isDeletingInvoice, startDeleteTransition] = useTransition();
  const [isUploadingReceipt, startUploadTransition] = useTransition();
  const [isGeneratingSmartReport, startSmartReportTransition] = useTransition();
  const [deletingInvoiceId, setDeletingInvoiceId] = useState<string | null>(null);
  const [uploadingInvoiceId, setUploadingInvoiceId] = useState<string | null>(null);
  const [isSmartAnalysisOpen, setIsSmartAnalysisOpen] = useState(false);
  const [smartAnalysisData, setSmartAnalysisData] = useState<VendorSmartAnalysisData | null>(null);
  const [smartAnalysisError, setSmartAnalysisError] = useState<string | null>(null);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const uploadInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const minDate = periodStart(selectedPeriod);
  const maxDate = periodEnd(selectedPeriod);

  const totalForMonth = useMemo(
    () => invoices.reduce((sum, invoice) => sum + invoice.amount, 0),
    [invoices],
  );

  const totalsByVendor = useMemo(() => {
    const base = { ...initialMonthlyTotals };
    for (const key of VENDOR_PAYABLE_CATEGORIES) base[key] = 0;
    for (const invoice of invoices) {
      base[invoice.vendorName] += invoice.amount;
    }
    return base;
  }, [initialMonthlyTotals, invoices]);

  const recentByVendor = useMemo(() => {
    const map = new Map<VendorPayableCategory, VendorInvoiceRow[]>();
    for (const vendor of VENDOR_PAYABLE_CATEGORIES) map.set(vendor, []);

    const sorted = [...invoices].sort((a, b) => {
      const byDate = b.invoiceDate.localeCompare(a.invoiceDate);
      if (byDate !== 0) return byDate;
      return b.createdAt.localeCompare(a.createdAt);
    });

    for (const invoice of sorted) {
      const current = map.get(invoice.vendorName) ?? [];
      if (current.length < 4) current.push(invoice);
      map.set(invoice.vendorName, current);
    }
    return map;
  }, [invoices]);

  const tableInvoices = useMemo(
    () =>
      [...invoices].sort((a, b) => {
        const byDate = b.invoiceDate.localeCompare(a.invoiceDate);
        if (byDate !== 0) return byDate;
        return b.createdAt.localeCompare(a.createdAt);
      }),
    [invoices],
  );

  const trendSummary = useMemo(() => {
    return VENDOR_PAYABLE_CATEGORIES.map((vendor) => {
      const points = trendSeriesByVendor[vendor] ?? [];
      const current = points.at(-1)?.total ?? 0;
      const previous = points.at(-2)?.total ?? 0;
      const status = getSmartStatus(current, previous);
      const changePct = previous > 0 ? ((current - previous) / previous) * 100 : current > 0 ? 100 : 0;
      return {
        vendor,
        points,
        current,
        previous,
        status,
        changePct,
      };
    });
  }, [trendSeriesByVendor]);

  const openModal = (vendor: VendorPayableCategory) => {
    setActiveVendor(vendor);
    setAmountInput('');
    setInvoiceDateInput(periodStart(selectedPeriod));
    setReceiptFile(null);
    setMessage(null);
    setError(null);
  };

  const closeModal = () => {
    setActiveVendor(null);
  };

  const onSubmitInvoice = () => {
    if (!activeVendor) return;

    const amount = parseAmount(amountInput);
    if (amount <= 0) {
      setError('Amount must be greater than zero.');
      return;
    }
    if (!invoiceDateInput) {
      setError('Invoice date is required.');
      return;
    }

    setError(null);
    setMessage(null);
    startSubmitTransition(async () => {
      const result = await addVendorInvoiceAction({
        branchId,
        vendorName: activeVendor,
        invoiceDate: invoiceDateInput,
        amount,
        receiptFile,
      });

      if (!result.success) {
        setError(result.error ?? 'Failed to log invoice.');
        return;
      }

      const insertedId = result.data?.id;
      if (!insertedId) {
        setError('Invoice was saved but no invoice id was returned.');
        return;
      }

      setInvoices((current) => [
        {
          id: insertedId,
          vendorName: activeVendor,
          invoiceDate: invoiceDateInput,
          amount: Number(amount.toFixed(2)),
          receiptUrl: result.data?.receiptUrl ?? null,
          createdAt: new Date().toISOString(),
        },
        ...current,
      ]);

      setMessage(`${activeVendor} invoice logged successfully.`);
      closeModal();
    });
  };

  const onDeleteInvoice = (invoice: VendorInvoiceRow) => {
    setError(null);
    setMessage(null);
    setDeletingInvoiceId(invoice.id);
    startDeleteTransition(async () => {
      const result = await deleteVendorInvoiceAction({
        branchId,
        invoiceId: invoice.id,
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to delete invoice.');
        setDeletingInvoiceId(null);
        return;
      }

      setInvoices((current) => current.filter((item) => item.id !== invoice.id));
      setMessage('Invoice deleted.');
      setDeletingInvoiceId(null);
    });
  };

  const onUploadReceipt = (invoice: VendorInvoiceRow, file: File | null) => {
    if (!file) return;
    setError(null);
    setMessage(null);
    setUploadingInvoiceId(invoice.id);
    startUploadTransition(async () => {
      const result = await attachVendorInvoiceReceiptAction({
        branchId,
        invoiceId: invoice.id,
        vendorName: invoice.vendorName,
        invoiceDate: invoice.invoiceDate,
        file,
      });
      if (!result.success) {
        setError(result.error ?? 'Failed to upload receipt.');
        setUploadingInvoiceId(null);
        return;
      }

      const receiptUrl = result.data?.receiptUrl ?? null;
      setInvoices((current) =>
        current.map((item) => (item.id === invoice.id ? { ...item, receiptUrl } : item)),
      );
      setMessage('Receipt uploaded successfully.');
      setUploadingInvoiceId(null);
    });
  };

  const onGenerateSmartReport = () => {
    setSmartAnalysisError(null);
    startSmartReportTransition(async () => {
      const result = await getVendorSmartAnalysisAction({
        branchId,
        period: selectedPeriod,
      });
      if (!result.success) {
        setSmartAnalysisError(result.error ?? 'Failed to generate smart report.');
        return;
      }
      setSmartAnalysisData(result.data ?? null);
    });
  };

  const onOpenSmartAnalysis = () => {
    setIsSmartAnalysisOpen(true);
    if (!smartAnalysisData && !isGeneratingSmartReport) {
      onGenerateSmartReport();
    }
  };

  const onExportPdf = () => {
    setIsExportingPdf(true);
    try {
      exportVendorReportPDF({
        branchName,
        monthLabel,
        insights: smartAnalysisData?.insights ?? [],
        rows:
          smartAnalysisData?.vendorBreakdown ?? trendSummary.map((item) => ({
            vendorName: item.vendor,
            total: item.current,
            sharePct: totalForMonth > 0 ? Number(((item.current / totalForMonth) * 100).toFixed(2)) : 0,
            status: item.status,
          })),
        totalSpend: smartAnalysisData?.totalCurrentMonthSpend ?? totalForMonth,
      });
    } finally {
      setIsExportingPdf(false);
    }
  };

  return (
    <section className="space-y-6" dir="ltr">
      <Card className="overflow-hidden rounded-[2rem] border border-slate-200 bg-gradient-to-r from-[#0b1220] via-[#0f172a] to-[#172554] p-8 text-white shadow-[0_24px_60px_rgba(15,23,42,0.28)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <Badge className="rounded-full border border-white/20 bg-white/10 text-white">
              <Sparkles className="mr-1 h-3.5 w-3.5" />
              Vendors & Payables
            </Badge>
            <h1 className="text-3xl font-black tracking-tight md:text-4xl">
              {branchName} Vendor Control Center
            </h1>
            <p className="max-w-2xl text-sm text-slate-200">
              Track invoice activity by category, monitor monthly spend, and keep receipts ready for
              accounting reviews.
            </p>
          </div>
          <div className="rounded-2xl border border-white/20 bg-white/10 px-5 py-4 text-right backdrop-blur">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-200">
              Total Spend ({monthLabel})
            </p>
            <p className="mt-1 text-3xl font-black">{formatCurrency(totalForMonth)}</p>
            <Link
              href={`/branch/${branchId}/financials?period=${selectedPeriod}`}
              className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-cyan-200 hover:text-white"
            >
              View Monthly P&L
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </div>
      </Card>

      {error ? (
        <Card className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
          {error}
        </Card>
      ) : null}
      {message ? (
        <Card className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-700">
          {message}
        </Card>
      ) : null}

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button variant="outline" onClick={onOpenSmartAnalysis} disabled={isGeneratingSmartReport}>
          {isGeneratingSmartReport ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4" />
          )}
          Smart Report
        </Button>
        <Button variant="default" onClick={onExportPdf} disabled={isExportingPdf || isGeneratingSmartReport}>
          {isExportingPdf ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          Export PDF
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-5 md:grid-cols-2 xl:grid-cols-4">
        {trendSummary.map((summary) => {
          const total = totalsByVendor[summary.vendor] ?? 0;
          const recent = recentByVendor.get(summary.vendor) ?? [];
          const gradientId = `sparkline-fill-${summary.vendor.replace(/[^a-z0-9]/gi, '-').toLowerCase()}`;

          return (
            <Card
              key={summary.vendor}
              className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Category
                  </p>
                  <h2 className="mt-1 text-xl font-bold text-slate-900">{summary.vendor}</h2>
                </div>
                <Badge className={`rounded-full border ${getStatusStyle(summary.status)}`}>
                  {summary.status}
                </Badge>
              </div>

              <div className="mt-4 h-20 rounded-2xl border border-slate-200 bg-slate-50 p-2">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.points}>
                    <defs>
                      <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#0f172a" stopOpacity={0.35} />
                        <stop offset="100%" stopColor="#0f172a" stopOpacity={0.02} />
                      </linearGradient>
                    </defs>
                    <Area
                      type="monotone"
                      dataKey="total"
                      stroke="#0f172a"
                      strokeWidth={2}
                      fill={`url(#${gradientId})`}
                      fillOpacity={1}
                      isAnimationActive={false}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Spent In {monthLabel}
                </p>
                <p className="mt-1 text-3xl font-black text-slate-900">{formatCurrency(total)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-600">
                  {summary.changePct >= 0 ? '+' : ''}
                  {summary.changePct.toFixed(1)}% vs previous month
                </p>
              </div>

              <Button
                className="mt-4 w-full rounded-xl"
                onClick={() => openModal(summary.vendor)}
                disabled={isSubmittingInvoice || isDeletingInvoice || isUploadingReceipt}
              >
                <Plus className="h-4 w-4" />
                Log Invoice
              </Button>

              <div className="mt-4 space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Recent Invoices
                </p>

                {recent.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-slate-300 px-3 py-4 text-sm text-slate-500">
                    No invoices logged for this month yet.
                  </div>
                ) : (
                  recent.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">
                          {formatCurrency(invoice.amount)}
                        </p>
                        <p className="text-xs text-slate-500">{formatDate(invoice.invoiceDate)}</p>
                      </div>
                      <div className="mt-2 flex items-center gap-2">
                        {invoice.receiptUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(invoice.receiptUrl ?? '', '_blank')}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View Receipt
                          </Button>
                        ) : (
                          <Badge variant="outline" className="border-slate-200 text-slate-500">
                            No receipt
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          onClick={() => onDeleteInvoice(invoice)}
                          disabled={isDeletingInvoice || isUploadingReceipt || isSubmittingInvoice}
                        >
                          {isDeletingInvoice && deletingInvoiceId === invoice.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                          Delete
                        </Button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <Card className="rounded-[1.6rem] border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.08)]">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">Invoice Management</p>
            <h3 className="mt-1 text-xl font-black text-slate-900">Detailed Invoice Ledger</h3>
          </div>
          <Badge variant="outline" className="border-slate-200 text-slate-600">
            {tableInvoices.length} entries
          </Badge>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="min-w-[800px] w-full border-collapse">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="px-3 py-3">Vendor</th>
                <th className="px-3 py-3">Date</th>
                <th className="px-3 py-3">Amount</th>
                <th className="px-3 py-3">Receipt</th>
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {tableInvoices.length > 0 ? (
                tableInvoices.map((invoice) => {
                  const isRowPending =
                    (isDeletingInvoice && deletingInvoiceId === invoice.id) ||
                    (isUploadingReceipt && uploadingInvoiceId === invoice.id);
                  return (
                    <tr key={invoice.id} className={`border-b border-slate-100 ${isRowPending ? 'opacity-70 pointer-events-none' : ''}`}>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900">{invoice.vendorName}</td>
                      <td className="px-3 py-3 text-sm text-slate-600">{formatDate(invoice.invoiceDate)}</td>
                      <td className="px-3 py-3 text-sm font-semibold text-slate-900">
                        {formatCurrency(invoice.amount)}
                      </td>
                      <td className="px-3 py-3">
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          className="hidden"
                          ref={(node) => {
                            uploadInputRefs.current[invoice.id] = node;
                          }}
                          onChange={(event) => {
                            const file = event.currentTarget.files?.[0] ?? null;
                            event.currentTarget.value = '';
                            onUploadReceipt(invoice, file);
                          }}
                        />
                        {invoice.receiptUrl ? (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => window.open(invoice.receiptUrl ?? '', '_blank')}
                            disabled={isRowPending}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        ) : (
                          <Badge variant="outline" className="border-slate-200 text-slate-500">
                            No Receipt
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <div className="flex items-center gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={isRowPending}
                            onClick={() => uploadInputRefs.current[invoice.id]?.click()}
                          >
                            {isUploadingReceipt && uploadingInvoiceId === invoice.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Receipt className="h-3.5 w-3.5" />
                            )}
                            Upload
                          </Button>
                          <Button
                            size="sm"
                            variant="destructive"
                            onClick={() => onDeleteInvoice(invoice)}
                            disabled={isRowPending}
                          >
                            {isDeletingInvoice && deletingInvoiceId === invoice.id ? (
                              <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                            Delete
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-sm text-slate-500">
                    No invoices logged for this period.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {activeVendor ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/45 px-4">
          <Card
            className={`w-full max-w-lg rounded-[1.6rem] border border-slate-200 bg-white p-6 shadow-[0_30px_80px_rgba(15,23,42,0.4)] ${
              isSubmittingInvoice ? 'opacity-70 pointer-events-none' : ''
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                  Log Invoice
                </p>
                <h3 className="mt-1 text-2xl font-black text-slate-900">{activeVendor}</h3>
              </div>
              <Button variant="ghost" size="sm" onClick={closeModal}>
                Close
              </Button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block space-y-2">
                <span className="text-sm font-semibold text-slate-700">Amount</span>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-slate-500">$</span>
                  <input
                    value={amountInput}
                    onChange={(event) => setAmountInput(event.target.value)}
                    inputMode="decimal"
                    placeholder="0.00"
                    disabled={isSubmittingInvoice}
                    className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm font-medium text-slate-900 outline-none focus:border-slate-500"
                  />
                </div>
              </label>

              <label className="block space-y-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <CalendarClock className="h-4 w-4 text-slate-500" />
                  Invoice Date
                </span>
                <input
                  type="date"
                  value={invoiceDateInput}
                  min={minDate}
                  max={maxDate}
                  onChange={(event) => setInvoiceDateInput(event.target.value)}
                  disabled={isSubmittingInvoice}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-900 outline-none focus:border-slate-500"
                />
              </label>

              <label className="block space-y-2">
                <span className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <ReceiptText className="h-4 w-4 text-slate-500" />
                  Upload Receipt (Optional)
                </span>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(event) => setReceiptFile(event.target.files?.[0] ?? null)}
                  disabled={isSubmittingInvoice}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-900 file:px-3 file:py-1.5 file:text-xs file:font-semibold file:text-white hover:file:bg-slate-700"
                />
                {receiptFile ? (
                  <Badge variant="outline" className="border-slate-200 text-slate-600">
                    <Building2 className="mr-1 h-3.5 w-3.5" />
                    {receiptFile.name}
                  </Badge>
                ) : null}
              </label>
            </div>

            <div className="mt-6 flex items-center justify-end gap-2">
              <Button variant="outline" onClick={closeModal} disabled={isSubmittingInvoice}>
                Cancel
              </Button>
              <Button onClick={onSubmitInvoice} disabled={isSubmittingInvoice}>
                {isSubmittingInvoice ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
                {isSubmittingInvoice ? 'Saving...' : 'Save Invoice'}
              </Button>
            </div>
          </Card>
        </div>
      ) : null}

      <VendorSmartAnalysis
        open={isSmartAnalysisOpen}
        onOpenChange={setIsSmartAnalysisOpen}
        isPending={isGeneratingSmartReport}
        onGenerate={onGenerateSmartReport}
        data={smartAnalysisData}
        errorMessage={smartAnalysisError}
      />
    </section>
  );
}
