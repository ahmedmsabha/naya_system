'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Link2, Loader2, RefreshCw, Save, Upload } from 'lucide-react';
import { upsertDeductions, upsertExpense } from '@/app/(dashboard)/branch/[id]/financials/actions';
import {
  MONTHLY_PNL_EXPENSE_CATEGORIES,
  isVendorPayableCategory,
  type MonthlyPnLDeductionCategory,
  type MonthlyPnLExpenseCategory,
} from '@/lib/finance/monthly-pnl';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ExpenseRow = {
  category: MonthlyPnLExpenseCategory;
  amount: number;
  receiptUrl: string | null;
  readOnly: boolean;
  helperLinkHref?: string;
  helperLinkLabel?: string;
};

type DeductionValues = Record<MonthlyPnLDeductionCategory, number>;
type UploadState = 'empty' | 'uploading' | 'ready';

type MonthlyPnLTableProps = {
  branchId: string;
  monthPeriod: string;
  totalCollected: number;
  initialRows: ExpenseRow[];
  initialDeductions: DeductionValues;
  onDataChange?: (payload: {
    rows: ExpenseRow[];
    deductions: DeductionValues;
    totalExpenses: number;
    totalDeductions: number;
    netTotal: number;
    finalPnL: number;
    vendorCogs: number;
    laborCost: number;
  }) => void;
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number): string {
  return `${value.toFixed(2)}%`;
}

function parseAmount(input: string): number {
  const normalized = input.trim().replace(/,/g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function isVendorManagedCategory(category: MonthlyPnLExpenseCategory): boolean {
  return isVendorPayableCategory(category);
}

export function MonthlyPnLTable({
  branchId,
  monthPeriod,
  totalCollected,
  initialRows,
  initialDeductions,
  onDataChange,
}: MonthlyPnLTableProps) {
  const [rows, setRows] = useState<ExpenseRow[]>(initialRows);
  const [deductions, setDeductions] = useState<DeductionValues>(initialDeductions);
  const [savingByCategory, setSavingByCategory] = useState<Record<string, boolean>>({});
  const [uploadStateByCategory, setUploadStateByCategory] = useState<Record<string, UploadState>>(
    Object.fromEntries(
      initialRows.map((row) => [row.category, row.receiptUrl ? 'ready' : 'empty']),
    ),
  );
  const [isSavingDeductions, setIsSavingDeductions] = useState(false);
  const [rowErrorMessage, setRowErrorMessage] = useState<string | null>(null);
  const [rowSuccessMessage, setRowSuccessMessage] = useState<string | null>(null);
  const [rowFeedbackCategory, setRowFeedbackCategory] = useState<MonthlyPnLExpenseCategory | null>(null);
  const [deductionErrorMessage, setDeductionErrorMessage] = useState<string | null>(null);
  const [deductionSuccessMessage, setDeductionSuccessMessage] = useState<string | null>(null);
  const fileInputsRef = useRef<Record<string, HTMLInputElement | null>>({});

  const rowsByCategory = useMemo(() => {
    const map = new Map<MonthlyPnLExpenseCategory, ExpenseRow>();
    for (const row of rows) map.set(row.category, row);
    return map;
  }, [rows]);

  const orderedRows = useMemo(
    () =>
      MONTHLY_PNL_EXPENSE_CATEGORIES.map(
        (category) =>
          rowsByCategory.get(category) ?? {
            category,
            amount: 0,
            receiptUrl: null,
            readOnly:
              category === 'Labor' || category === 'Warehouse' || isVendorManagedCategory(category),
            helperLinkHref:
              category === 'Labor'
                ? `/branch/${branchId}/staffing`
                : category === 'Warehouse'
                  ? `/branch/${branchId}/warehouse`
                  : isVendorManagedCategory(category)
                    ? `/branch/${branchId}/vendors?period=${monthPeriod}`
                    : undefined,
            helperLinkLabel:
              category === 'Labor'
                ? 'View Payroll'
                : category === 'Warehouse'
                  ? 'View Warehouse'
                  : isVendorManagedCategory(category)
                    ? 'View Vendors'
                    : undefined,
          },
      ),
    [branchId, monthPeriod, rowsByCategory],
  );

  const totalExpenses = useMemo(
    () => orderedRows.reduce((sum, row) => sum + Number(row.amount || 0), 0),
    [orderedRows],
  );

  const netTotal =
    totalCollected -
    (deductions['Square Fees'] +
      deductions.TX +
      deductions['Delivery Fee'] +
      deductions.Marketing);
  const finalPnL = netTotal - totalExpenses;
  const totalDeductions =
    deductions['Square Fees'] +
    deductions.TX +
    deductions['Delivery Fee'] +
    deductions.Marketing;
  const vendorCogs = orderedRows
    .filter((row) =>
      ['US Foods', 'Lenard Paper', 'PFG', "Keany's", 'Bread', 'Warehouse'].includes(row.category),
    )
    .reduce((sum, row) => sum + row.amount, 0);
  const laborCost = orderedRows.find((row) => row.category === 'Labor')?.amount ?? 0;

  useEffect(() => {
    onDataChange?.({
      rows: orderedRows,
      deductions,
      totalExpenses,
      totalDeductions,
      netTotal,
      finalPnL,
      vendorCogs,
      laborCost,
    });
  }, [
    deductions,
    finalPnL,
    laborCost,
    netTotal,
    onDataChange,
    orderedRows,
    totalDeductions,
    totalExpenses,
    vendorCogs,
  ]);

  const setRowAmount = (category: MonthlyPnLExpenseCategory, value: string) => {
    const nextAmount = parseAmount(value);
    setRows((current) =>
      current.map((row) =>
        row.category === category && !row.readOnly ? { ...row, amount: nextAmount } : row,
      ),
    );
  };

  const saveRow = async (row: ExpenseRow, file?: File) => {
    setRowErrorMessage(null);
    setRowSuccessMessage(null);
    setRowFeedbackCategory(row.category);
    setSavingByCategory((current) => ({ ...current, [row.category]: true }));

    if (file) {
      setUploadStateByCategory((current) => ({ ...current, [row.category]: 'uploading' }));
    }

    try {
      const result = await upsertExpense({
        branchId,
        monthPeriod,
        category: row.category,
        amount: row.amount,
        file,
      });

      if (!result.success) {
        setRowErrorMessage(result.error ?? `Failed to save ${row.category}.`);
        if (file) {
          setUploadStateByCategory((current) => ({
            ...current,
            [row.category]: row.receiptUrl ? 'ready' : 'empty',
          }));
        }
        return;
      }

      if (result.receiptUrl) {
        setRows((current) =>
          current.map((item) =>
            item.category === row.category
              ? { ...item, receiptUrl: result.receiptUrl ?? item.receiptUrl }
              : item,
          ),
        );
        setUploadStateByCategory((current) => ({ ...current, [row.category]: 'ready' }));
      } else if (!file) {
        setUploadStateByCategory((current) => ({
          ...current,
          [row.category]: row.receiptUrl ? 'ready' : 'empty',
        }));
      }

      setRowSuccessMessage(`${row.category} saved successfully.`);
    } catch {
      setRowErrorMessage(`Failed to save ${row.category}.`);
      if (file) {
        setUploadStateByCategory((current) => ({
          ...current,
          [row.category]: row.receiptUrl ? 'ready' : 'empty',
        }));
      }
    } finally {
      setSavingByCategory((current) => ({ ...current, [row.category]: false }));
    }
  };

  const triggerUpload = (category: MonthlyPnLExpenseCategory) => {
    fileInputsRef.current[category]?.click();
  };

  const onFileChange = async (row: ExpenseRow, files: FileList | null) => {
    if (!files || files.length === 0) return;
    const selectedFiles = Array.from(files);
    for (const file of selectedFiles) {
      await saveRow(row, file);
    }
  };

  const saveDeductions = async () => {
    setDeductionErrorMessage(null);
    setDeductionSuccessMessage(null);
    setIsSavingDeductions(true);
    try {
      const result = await upsertDeductions({
        branchId,
        monthPeriod,
        values: deductions,
      });
      if (!result.success) {
        setDeductionErrorMessage(result.error ?? 'Failed to save deductions.');
      } else {
        setDeductionSuccessMessage('Deductions saved successfully.');
      }
    } catch {
      setDeductionErrorMessage('Failed to save deductions.');
    } finally {
      setIsSavingDeductions(false);
    }
  };

  return (
    <section className="space-y-5">
      <Card className="rounded-3xl border border-slate-200 shadow-[0_10px_26px_rgba(15,23,42,0.08)] bg-white">
        <CardHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
                Monthly P&L Expense Entry
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950 mt-1">
                Category Ledger
              </CardTitle>
            </div>
            <div className="text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
                Total Collected
              </p>
              <p className="text-2xl font-semibold text-slate-950">{formatCurrency(totalCollected)}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-5">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[1040px] bg-white">
              <thead className="bg-slate-50">
                <tr className="text-left">
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Category
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Amount
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    % of Sales
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Receipt
                  </th>
                  <th className="px-5 py-3 text-xs font-semibold uppercase tracking-wider text-slate-500">
                    Save
                  </th>
                </tr>
              </thead>
              <tbody>
                {orderedRows.map((row) => {
                  const pctOfSales = totalCollected > 0 ? (row.amount / totalCollected) * 100 : 0;
                  const saving = Boolean(savingByCategory[row.category]);
                  const uploadState =
                    uploadStateByCategory[row.category] ?? (row.receiptUrl ? 'ready' : 'empty');
                  const rowPending = saving || uploadState === 'uploading';

                  return (
                    <tr
                      key={row.category}
                      className={`border-t border-slate-100 hover:bg-slate-50/60 ${
                        rowPending ? 'opacity-70 pointer-events-none' : ''
                      }`}
                    >
                      <td className="px-5 py-4">
                        <div className="flex flex-col">
                          <span className="text-sm font-semibold text-slate-800">{row.category}</span>
                          {row.readOnly && row.helperLinkHref ? (
                            <a
                              href={row.helperLinkHref}
                              className="mt-1 inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800"
                            >
                              <Link2 className="h-3.5 w-3.5" />
                              {row.helperLinkLabel}
                            </a>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <div className="relative">
                          <span className="absolute left-3 top-2.5 text-sm text-slate-500">$</span>
                          <input
                            value={row.amount.toFixed(2)}
                            onChange={(event) => setRowAmount(row.category, event.target.value)}
                            readOnly={row.readOnly}
                            inputMode="decimal"
                            className={`w-full rounded-lg border bg-white py-2 pl-7 pr-3 text-sm font-medium outline-none transition ${
                              row.readOnly
                                ? 'cursor-not-allowed border-slate-200 text-slate-500'
                                : 'border-slate-300 text-slate-800 focus:border-slate-500'
                            }`}
                          />
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm font-semibold text-slate-700">
                        {formatPercent(pctOfSales)}
                      </td>
                      <td className="px-5 py-4">
                        <input
                          ref={(node) => {
                            fileInputsRef.current[row.category] = node;
                          }}
                          type="file"
                          accept="image/*,application/pdf"
                          multiple
                          className="hidden"
                          onChange={async (event) => {
                            const input = event.currentTarget;
                            const files = input.files;
                            input.value = '';
                            await onFileChange(row, files);
                          }}
                        />

                        {uploadState === 'uploading' ? (
                          <Badge variant="outline" className="h-8 rounded-lg px-3 gap-2 text-slate-700">
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            Processing File...
                          </Badge>
                        ) : row.receiptUrl ? (
                          <div className="inline-flex items-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={rowPending}
                              onClick={() => window.open(row.receiptUrl ?? '', '_blank')}
                            >
                              <Eye className="h-3.5 w-3.5" />
                              View
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={rowPending}
                              onClick={() => triggerUpload(row.category)}
                            >
                              <RefreshCw className="h-3.5 w-3.5" />
                              Replace
                            </Button>
                          </div>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled={rowPending}
                            onClick={() => triggerUpload(row.category)}
                          >
                            <Upload className="h-3.5 w-3.5" />
                            Upload Receipt
                          </Button>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <Button
                          variant="default"
                          size="sm"
                          disabled={row.readOnly || rowPending}
                          onClick={() => saveRow(row)}
                        >
                          {rowPending ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Save className="h-3.5 w-3.5" />
                          )}
                          {rowPending ? 'Saving...' : 'Save'}
                        </Button>
                        {rowFeedbackCategory === row.category && rowErrorMessage ? (
                          <p className="mt-2 text-xs font-medium text-red-500">{rowErrorMessage}</p>
                        ) : null}
                        {rowFeedbackCategory === row.category && rowSuccessMessage ? (
                          <p className="mt-2 text-xs font-medium text-emerald-600">{rowSuccessMessage}</p>
                        ) : null}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-0 z-10 mt-4 rounded-2xl border border-slate-200 bg-white/95 p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <Badge variant="outline" className="h-8 px-3 text-slate-700">
                  Total Expenses {formatCurrency(totalExpenses)}
                </Badge>
                <Badge
                  variant="outline"
                  className={`h-8 px-3 ${
                    finalPnL >= 0
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                      : 'border-red-200 text-red-700 bg-red-50'
                  }`}
                >
                  Final P&L {formatCurrency(finalPnL)}
                </Badge>
              </div>
              <p className="text-xs text-slate-500">
                Final P&L = Net Total - Total Expenses
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-200 shadow-[0_10px_26px_rgba(15,23,42,0.08)] bg-white">
        <CardHeader className="px-6 pt-6 pb-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
                Monthly Summary
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950 mt-1">
                Net Total and Final P&L
              </CardTitle>
            </div>
            <div className="flex flex-col items-end gap-1">
              <Button onClick={saveDeductions} disabled={isSavingDeductions}>
                {isSavingDeductions ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isSavingDeductions ? 'Saving...' : 'Save Deductions'}
              </Button>
              {deductionErrorMessage ? (
                <p className="text-xs font-medium text-red-500">{deductionErrorMessage}</p>
              ) : null}
              {deductionSuccessMessage ? (
                <p className="text-xs font-medium text-emerald-600">{deductionSuccessMessage}</p>
              ) : null}
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-6 pb-6 pt-5">
          <div
            className={`grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4 ${
              isSavingDeductions ? 'opacity-70 pointer-events-none' : ''
            }`}
          >
            <SummaryInputCard
              label="Square Fees"
              value={deductions['Square Fees']}
              onChange={(value) => setDeductions((current) => ({ ...current, 'Square Fees': value }))}
            />
            <SummaryInputCard
              label="TX"
              value={deductions.TX}
              onChange={(value) => setDeductions((current) => ({ ...current, TX: value }))}
            />
            <SummaryInputCard
              label="Delivery Fee"
              value={deductions['Delivery Fee']}
              onChange={(value) => setDeductions((current) => ({ ...current, 'Delivery Fee': value }))}
            />
            <SummaryInputCard
              label="Marketing"
              value={deductions.Marketing}
              onChange={(value) => setDeductions((current) => ({ ...current, Marketing: value }))}
            />
            <SummaryReadCard label="Net Total" value={netTotal} />
            <SummaryReadCard label="Total Expenses" value={totalExpenses} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
                Final P&L
              </p>
              <p className={`mt-2 text-3xl font-semibold ${finalPnL >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(finalPnL)}
              </p>
              <p className="mt-1 text-xs text-slate-500">Final P&L = Net Total - Total Expenses</p>
            </div>
            <SummaryReadCard label="Total Collected" value={totalCollected} />
          </div>
        </CardContent>
      </Card>
    </section>
  );
}

function SummaryInputCard({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">{label}</p>
      <div className="relative mt-2">
        <span className="absolute left-3 top-2.5 text-sm text-slate-500">$</span>
        <input
          value={value.toFixed(2)}
          onChange={(event) => onChange(parseAmount(event.target.value))}
          inputMode="decimal"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-7 pr-3 text-sm font-semibold text-slate-900 outline-none focus:border-slate-500"
        />
      </div>
    </div>
  );
}

function SummaryReadCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">{label}</p>
      <p className="mt-2 text-2xl font-semibold text-slate-900">{formatCurrency(value)}</p>
    </div>
  );
}
