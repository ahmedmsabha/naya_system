import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft, CalendarDays, ChevronLeft, ChevronRight } from 'lucide-react';
import { createClient } from '@/lib/supabase/server';
import {
  VENDOR_PAYABLE_CATEGORIES,
  type VendorPayableCategory,
} from '@/lib/finance/monthly-pnl';
import { VendorsDashboard } from '@/components/finance/VendorsDashboard';

export const dynamic = 'force-dynamic';

type VendorInvoiceRow = {
  id: string;
  vendorName: VendorPayableCategory;
  invoiceDate: string;
  amount: number;
  receiptUrl: string | null;
  createdAt: string;
};

function monthKeyFromDate(input: Date): string {
  return `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, '0')}`;
}

function monthKeyNow(): string {
  return monthKeyFromDate(new Date());
}

function monthStartIso(period: string): string {
  return `${period}-01`;
}

function monthEndIso(period: string): string {
  const d = new Date(`${period}-01T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return `${period}-${String(d.getDate()).padStart(2, '0')}`;
}

function addMonths(period: string, delta: number): string {
  const d = new Date(`${period}-01T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  return monthKeyFromDate(d);
}

export default async function BranchVendorsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const selectedPeriod = /^\d{4}-\d{2}$/.test(String(sp.period ?? ''))
    ? String(sp.period)
    : monthKeyNow();

  const selectedStart = monthStartIso(selectedPeriod);
  const selectedEnd = monthEndIso(selectedPeriod);

  const supabase = await createClient();
  const [{ data: branch }, { data: invoiceRows }] = await Promise.all([
    supabase.from('branches').select('name').eq('id', id).single(),
    supabase
      .from('vendor_invoices')
      .select('id, vendor_name, invoice_date, amount, receipt_url, created_at')
      .eq('branch_id', id)
      .gte('invoice_date', selectedStart)
      .lte('invoice_date', selectedEnd)
      .order('invoice_date', { ascending: false })
      .order('created_at', { ascending: false }),
  ]);

  if (!branch) notFound();

  const initialInvoices: VendorInvoiceRow[] = (invoiceRows ?? [])
    .filter((row) => VENDOR_PAYABLE_CATEGORIES.includes(row.vendor_name as VendorPayableCategory))
    .map((row) => ({
      id: String(row.id),
      vendorName: row.vendor_name as VendorPayableCategory,
      invoiceDate: String(row.invoice_date),
      amount: Number(row.amount ?? 0) || 0,
      receiptUrl: row.receipt_url ? String(row.receipt_url) : null,
      createdAt: String(row.created_at),
    }));

  const monthlyTotals = Object.fromEntries(
    VENDOR_PAYABLE_CATEGORIES.map((vendor) => [vendor, 0]),
  ) as Record<VendorPayableCategory, number>;

  for (const invoice of initialInvoices) {
    monthlyTotals[invoice.vendorName] += invoice.amount;
  }

  const monthLabel = new Date(`${selectedPeriod}-01T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-full space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href={`/branch/${id}`}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-slate-600 transition hover:border-slate-300 hover:text-slate-900"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back To Branch Hub
        </Link>

        <div className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <Link
            href={`/branch/${id}/vendors?period=${addMonths(selectedPeriod, -1)}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="inline-flex items-center gap-2 rounded-xl bg-slate-50 px-4 py-2">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <span className="text-sm font-semibold text-slate-800">{monthLabel}</span>
          </div>
          <Link
            href={`/branch/${id}/vendors?period=${addMonths(selectedPeriod, 1)}`}
            className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      <VendorsDashboard
        branchId={id}
        branchName={String(branch.name ?? '')}
        selectedPeriod={selectedPeriod}
        monthLabel={monthLabel}
        initialInvoices={initialInvoices}
        initialMonthlyTotals={monthlyTotals}
      />
    </div>
  );
}
