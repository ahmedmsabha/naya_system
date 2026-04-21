'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Eye, Link2, Loader2, RefreshCw, Save, Upload } from 'lucide-react';
import { upsertDeductions, upsertExpense } from '@/app/(dashboard)/branch/[id]/financials/actions';
import {
  MONTHLY_PNL_EXPENSE_CATEGORIES,
  isCogsExpenseCategory,
  isVendorPayableCategory,
  type MonthlyPnLDeductionCategory,
  type MonthlyPnLExpenseCategory,
} from '@/lib/finance/monthly-pnl';
import type { ExpenseReadOnlyReason } from '@/lib/finance/financials-expense-aggregation';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

type ExpenseRow = {
  category: MonthlyPnLExpenseCategory;
  amount: number;
  receiptUrl: string | null;
  readOnly: boolean;
  readOnlyReason?: ExpenseReadOnlyReason;
  supersededManualAmount?: number;
  helperLinkHref?: string;
  helperLinkLabel?: string;
};

const READ_ONLY_HINT: Record<ExpenseReadOnlyReason, string> = {
  labor_payroll: 'Total comes from payroll snapshots (staffing). Manual amount in this sheet is not used.',
  warehouse_invoices: 'Total comes from warehouse invoices. Manual amount in this sheet is not used.',
  vendor_invoices:
    'Total comes from vendor invoices (matched by category name). Manual amount in this sheet is not used.',
};

type DeductionValues = Record<MonthlyPnLDeductionCategory, number>;
type UploadState = 'empty' | 'uploading' | 'ready';

export type MonthlyPnLDataChangePayload = {
  rows: ExpenseRow[];
  deductions: DeductionValues;
  totalExpenses: number;
  totalDeductions: number;
  /** Gross sales − deductions (same as dashboard “net sales” before COGS). */
  netTotal: number;
  /** Net Sales − COGS − Labor − remaining OpEx (matches server EBITDA definition). */
  ebitda: number;
  finalPnL: number;
  vendorCogs: number;
  laborCost: number;
  /** Total expenses − COGS − Labor (utilities, rent, manual royalty, etc.). */
  opexAfterCogsLabor: number;
};

type MonthlyPnLTableProps = {
  branchId: string;
  monthPeriod: string;
  totalCollected: number;
  initialRows: ExpenseRow[];
  initialDeductions: DeductionValues;
  onDataChange?: (payload: MonthlyPnLDataChangePayload) => void;
};

const DEBOUNCE_MS = 220;
const DRAFT_DEBOUNCE_MS = 280;

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

function defaultRowForCategory(
  category: MonthlyPnLExpenseCategory,
  branchId: string,
  monthPeriod: string,
): ExpenseRow {
  return {
    category,
    amount: 0,
    receiptUrl: null,
    readOnly: category === 'Labor' || category === 'Warehouse' || isVendorManagedCategory(category),
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
  };
}

/** Stable full row list in category order; fills gaps from `rows` state. */
export function buildOrderedExpenseRows(
  rows: ExpenseRow[],
  branchId: string,
  monthPeriod: string,
): ExpenseRow[] {
  const map = new Map<MonthlyPnLExpenseCategory, ExpenseRow>();
  for (const row of rows) map.set(row.category, row);
  return MONTHLY_PNL_EXPENSE_CATEGORIES.map(
    (category) => map.get(category) ?? defaultRowForCategory(category, branchId, monthPeriod),
  );
}

/**
 * Dashboard-aligned math:
 * - Net Sales = Gross (total collected) − deductions
 * - EBITDA = Net Sales − COGS − Labor − OpEx (where OpEx = all other expense lines)
 * Algebraically: EBITDA = Net Sales − sum(all expense rows) because rows partition COGS + Labor + OpEx.
 */
export function computeMonthlyPnLMetrics(
  totalCollected: number,
  orderedRows: ExpenseRow[],
  deductions: DeductionValues,
) {
  const totalDeductions =
    deductions['Square Fees'] +
    deductions.TX +
    deductions['Delivery Fee'] +
    deductions.Marketing;
  const netTotal = totalCollected - totalDeductions;

  const totalExpenses = orderedRows.reduce((sum, row) => sum + row.amount, 0);

  const cogs = orderedRows
    .filter((row) => isCogsExpenseCategory(row.category))
    .reduce((sum, row) => sum + row.amount, 0);

  const laborCost = orderedRows.find((row) => row.category === 'Labor')?.amount ?? 0;

  const opexAfterCogsLabor = Math.max(0, totalExpenses - cogs - laborCost);

  const ebitda = netTotal - cogs - laborCost - opexAfterCogsLabor;
  const finalPnL = netTotal - totalExpenses;

  const vendorCogs = cogs;

  return {
    totalDeductions,
    netTotal,
    totalExpenses,
    cogs,
    laborCost,
    opexAfterCogsLabor,
    ebitda,
    finalPnL,
    vendorCogs,
  };
}

function payloadsEqual(a: MonthlyPnLDataChangePayload, b: MonthlyPnLDataChangePayload): boolean {
  if (a.netTotal !== b.netTotal || a.finalPnL !== b.finalPnL || a.ebitda !== b.ebitda) return false;
  if (
    a.totalExpenses !== b.totalExpenses ||
    a.totalDeductions !== b.totalDeductions ||
    a.laborCost !== b.laborCost ||
    a.vendorCogs !== b.vendorCogs ||
    a.opexAfterCogsLabor !== b.opexAfterCogsLabor
  ) {
    return false;
  }
  if (a.rows.length !== b.rows.length) return false;
  for (let i = 0; i < a.rows.length; i += 1) {
    if (a.rows[i].category !== b.rows[i].category || a.rows[i].amount !== b.rows[i].amount) {
      return false;
    }
  }
  const dk = Object.keys(a.deductions) as MonthlyPnLDeductionCategory[];
  for (const k of dk) {
    if (a.deductions[k] !== b.deductions[k]) return false;
  }
  return true;
}

export function MonthlyPnLTable({
  branchId,
  monthPeriod,
  totalCollected,
  initialRows,
  initialDeductions,
  onDataChange,
}: MonthlyPnLTableProps) {
  const periodKey = `${branchId}::${monthPeriod}`;
  const lastPeriodKeyRef = useRef(periodKey);

  const [rows, setRows] = useState<ExpenseRow[]>(initialRows);
  const [deductions, setDeductions] = useState<DeductionValues>(initialDeductions);

  /** String drafts for editable categories — avoids committing `rows` on every keystroke. */
  const [draftByCategory, setDraftByCategory] = useState<
    Partial<Record<MonthlyPnLExpenseCategory, string>>
  >({});

  const draftTimerByCategoryRef = useRef<
    Partial<Record<MonthlyPnLExpenseCategory, ReturnType<typeof setTimeout>>>
  >({});
  const draftValueRef = useRef<Partial<Record<MonthlyPnLExpenseCategory, string>>>({});

  const [savingByCategory, setSavingByCategory] = useState<Record<string, boolean>>({});
  const [uploadStateByCategory, setUploadStateByCategory] = useState<Record<string, UploadState>>(
    () =>
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

  const onDataChangeRef = useRef(onDataChange);
  onDataChangeRef.current = onDataChange;

  const rowsRef = useRef(rows);
  const deductionsRef = useRef(deductions);
  rowsRef.current = rows;
  deductionsRef.current = deductions;

  const lastPayloadRef = useRef<MonthlyPnLDataChangePayload | null>(null);
  const notifyDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Reset local state only when navigating branch/month — not on every parent re-render (avoids feedback loops). */
  useEffect(() => {
    if (lastPeriodKeyRef.current === periodKey) return;
    lastPeriodKeyRef.current = periodKey;
    lastPayloadRef.current = null;
    setRows(initialRows);
    setDeductions(initialDeductions);
    setDraftByCategory({});
    draftValueRef.current = {};
    draftTimerByCategoryRef.current = {};
    setUploadStateByCategory(
      Object.fromEntries(
        initialRows.map((row) => [row.category, row.receiptUrl ? 'ready' : 'empty']),
      ),
    );
  }, [periodKey, initialRows, initialDeductions]);

  const orderedRows = useMemo(
    () => buildOrderedExpenseRows(rows, branchId, monthPeriod),
    [rows, branchId, monthPeriod],
  );

  const automatedRows = useMemo(() => orderedRows.filter((r) => r.readOnly), [orderedRows]);
  const manualRows = useMemo(() => orderedRows.filter((r) => !r.readOnly), [orderedRows]);

  const metrics = useMemo(
    () => computeMonthlyPnLMetrics(totalCollected, orderedRows, deductions),
    [totalCollected, orderedRows, deductions],
  );

  const flushDraftToRows = useCallback((category: MonthlyPnLExpenseCategory) => {
    const raw = draftValueRef.current[category] ?? draftByCategory[category];
    if (raw === undefined) return;
    const nextAmount = parseAmount(raw);
    setRows((current) =>
      current.map((row) =>
        row.category === category && !row.readOnly ? { ...row, amount: nextAmount } : row,
      ),
    );
    setDraftByCategory((prev) => {
      const next = { ...prev };
      delete next[category];
      return next;
    });
    delete draftValueRef.current[category];
  }, [draftByCategory]);

  const commitDraftNow = useCallback(
    (category: MonthlyPnLExpenseCategory) => {
      const pending = draftTimerByCategoryRef.current[category];
      if (pending) {
        clearTimeout(pending);
        draftTimerByCategoryRef.current[category] = undefined;
      }
      flushDraftToRows(category);
    },
    [flushDraftToRows],
  );

  const scheduleDraftCommit = useCallback(
    (category: MonthlyPnLExpenseCategory) => {
      const prev = draftTimerByCategoryRef.current[category];
      if (prev) clearTimeout(prev);
      draftTimerByCategoryRef.current[category] = setTimeout(() => {
        draftTimerByCategoryRef.current[category] = undefined;
        flushDraftToRows(category);
      }, DRAFT_DEBOUNCE_MS);
    },
    [flushDraftToRows],
  );

  const setRowAmountDraft = useCallback(
    (category: MonthlyPnLExpenseCategory, value: string) => {
      draftValueRef.current[category] = value;
      setDraftByCategory((prev) => ({ ...prev, [category]: value }));
      scheduleDraftCommit(category);
    },
    [scheduleDraftCommit],
  );

  const notifyParent = useCallback(() => {
    const cb = onDataChangeRef.current;
    if (!cb) return;

    const ordered = buildOrderedExpenseRows(rowsRef.current, branchId, monthPeriod);
    const m = computeMonthlyPnLMetrics(totalCollected, ordered, deductionsRef.current);

    const payload: MonthlyPnLDataChangePayload = {
      rows: ordered,
      deductions: deductionsRef.current,
      totalExpenses: m.totalExpenses,
      totalDeductions: m.totalDeductions,
      netTotal: m.netTotal,
      ebitda: m.ebitda,
      finalPnL: m.finalPnL,
      vendorCogs: m.vendorCogs,
      laborCost: m.laborCost,
      opexAfterCogsLabor: m.opexAfterCogsLabor,
    };

    if (lastPayloadRef.current && payloadsEqual(lastPayloadRef.current, payload)) {
      return;
    }
    lastPayloadRef.current = payload;
    cb(payload);
  }, [branchId, monthPeriod, totalCollected]);

  /** Debounced parent sync: avoids hammering context on each render / keystroke. */
  useEffect(() => {
    if (!onDataChange) return;
    if (notifyDebounceRef.current) clearTimeout(notifyDebounceRef.current);
    notifyDebounceRef.current = setTimeout(() => {
      notifyDebounceRef.current = null;
      notifyParent();
    }, DEBOUNCE_MS);
    return () => {
      if (notifyDebounceRef.current) clearTimeout(notifyDebounceRef.current);
    };
  }, [rows, deductions, notifyParent]);

  /** After period navigation or first paint, notify parent without waiting for the debounce timer. */
  useEffect(() => {
    queueMicrotask(() => notifyParent());
  }, [periodKey, notifyParent]);

  const renderRow = (row: ExpenseRow) => {
    const pctOfSales = totalCollected > 0 ? (row.amount / totalCollected) * 100 : 0;
    const saving = Boolean(savingByCategory[row.category]);
    const uploadState =
      uploadStateByCategory[row.category] ?? (row.receiptUrl ? 'ready' : 'empty');
    const rowPending = saving || uploadState === 'uploading';

    const displayAmount =
      !row.readOnly && draftByCategory[row.category] !== undefined
        ? draftByCategory[row.category]!
        : row.amount.toFixed(2);

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
            {row.readOnly && row.readOnlyReason ? (
              <span className="mt-1 block text-[11px] leading-snug text-slate-500">
                {READ_ONLY_HINT[row.readOnlyReason]}
                {row.supersededManualAmount != null && row.supersededManualAmount > 0 ? (
                  <>
                    {' '}
                    (Ignored manual entry: {formatCurrency(row.supersededManualAmount)})
                  </>
                ) : null}
              </span>
            ) : null}
          </div>
        </td>
        <td className="px-5 py-4">
          <div className="relative">
            <span className="absolute left-3 top-2.5 text-sm text-slate-500">$</span>
            <input
              value={displayAmount}
              onChange={(event) => {
                if (row.readOnly) return;
                setRowAmountDraft(row.category, event.target.value);
              }}
              onBlur={() => {
                if (row.readOnly) return;
                commitDraftNow(row.category);
              }}
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
            {rowPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
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
  };

  const saveRow = async (row: ExpenseRow, file?: File) => {
    if (!row.readOnly) commitDraftNow(row.category);

    setRowErrorMessage(null);
    setRowSuccessMessage(null);
    setRowFeedbackCategory(row.category);
    setSavingByCategory((current) => ({ ...current, [row.category]: true }));

    if (file) {
      setUploadStateByCategory((current) => ({ ...current, [row.category]: 'uploading' }));
    }

    const rowToSave =
      !row.readOnly && draftByCategory[row.category] !== undefined
        ? { ...row, amount: parseAmount(draftByCategory[row.category]!) }
        : row;

    try {
      const result = await upsertExpense({
        branchId,
        monthPeriod,
        category: rowToSave.category,
        amount: rowToSave.amount,
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
      if (!row.readOnly) {
        setDraftByCategory((prev) => {
          const next = { ...prev };
          delete next[row.category];
          return next;
        });
        delete draftValueRef.current[row.category];
      }
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

  const {
    netTotal,
    totalExpenses,
    totalDeductions,
    ebitda,
    finalPnL,
    cogs,
    laborCost,
    opexAfterCogsLabor,
  } = metrics;

  return (
    <section className="space-y-5">
      <Card className="rounded-3xl border border-slate-200 shadow-[0_10px_26px_rgba(15,23,42,0.08)] bg-white">
        <CardHeader className="px-4 sm:px-6 pt-6 pb-0">
          <div className="flex items-start sm:items-center justify-between gap-3 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
                Monthly P&L Expense Entry
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950 mt-1">
                Category Ledger
              </CardTitle>
            </div>
            <div className="text-left sm:text-right">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
                Gross (total collected)
              </p>
              <p className="text-2xl font-semibold text-slate-950">{formatCurrency(totalCollected)}</p>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 sm:px-6 pb-6 pt-5">
          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-sm">
            <table className="w-full min-w-[900px] md:min-w-[1040px] bg-white">
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
                <tr className="bg-slate-100/90">
                  <td
                    colSpan={5}
                    className="px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-slate-600"
                  >
                    Automated (read-only — payroll, warehouse, vendor invoices)
                  </td>
                </tr>
                {automatedRows.map((row) => renderRow(row))}
                <tr className="bg-emerald-50/80">
                  <td
                    colSpan={5}
                    className="px-5 py-2 text-[11px] font-black uppercase tracking-[0.2em] text-emerald-900"
                  >
                    Manual entry (editable categories)
                  </td>
                </tr>
                {manualRows.map((row) => renderRow(row))}
              </tbody>
            </table>
          </div>

          <div className="sticky bottom-0 z-10 mt-4 rounded-2xl border border-slate-200 bg-white/95 p-3 sm:p-4 shadow-[0_-8px_20px_rgba(15,23,42,0.08)] backdrop-blur">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                <Badge variant="outline" className="h-8 px-3 text-slate-700">
                  Net sales {formatCurrency(netTotal)}
                </Badge>
                <Badge variant="outline" className="h-8 px-3 text-slate-700">
                  Total expenses {formatCurrency(totalExpenses)}
                </Badge>
                <Badge
                  variant="outline"
                  className={`h-8 px-3 ${
                    ebitda >= 0
                      ? 'border-emerald-200 text-emerald-700 bg-emerald-50'
                      : 'border-red-200 text-red-700 bg-red-50'
                  }`}
                >
                  EBITDA {formatCurrency(ebitda)}
                </Badge>
              </div>
              <p className="max-w-md text-xs text-slate-500">
                Net sales = Gross − deductions. EBITDA = Net sales − COGS − Labor − OpEx (= Net sales − total
                expenses).
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="rounded-3xl border border-slate-200 shadow-[0_10px_26px_rgba(15,23,42,0.08)] bg-white">
        <CardHeader className="px-4 sm:px-6 pt-6 pb-0">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
                Monthly Summary
              </p>
              <CardTitle className="text-2xl font-semibold tracking-tight text-slate-950 mt-1">
                Deductions, net sales &amp; EBITDA
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

        <CardContent className="px-4 sm:px-6 pb-6 pt-5">
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
            <SummaryReadCard label="Total deductions" value={totalDeductions} />
            <SummaryReadCard label="Net sales" value={netTotal} />
            <SummaryReadCard label="COGS" value={cogs} />
            <SummaryReadCard label="Labor" value={laborCost} />
            <SummaryReadCard label="OpEx (after COGS & labor)" value={opexAfterCogsLabor} />
            <SummaryReadCard label="Total expenses" value={totalExpenses} />
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 xl:col-span-2">
              <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">EBITDA</p>
              <p className={`mt-2 text-3xl font-semibold ${ebitda >= 0 ? 'text-emerald-600' : 'text-red-600'}`}>
                {formatCurrency(ebitda)}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                EBITDA = Net sales − COGS − Labor − OpEx. Same as Net sales − Total expenses ({formatCurrency(finalPnL)}
                ).
              </p>
            </div>
            <SummaryReadCard label="Gross (total collected)" value={totalCollected} />
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
