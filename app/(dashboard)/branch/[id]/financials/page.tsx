import { notFound } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { generateFinancialCommentary } from '@/lib/ai/financial-commentary';
import { FinancialsDashboardClient } from '@/components/finance/FinancialsDashboardClient';
import {
  MONTHLY_PNL_DEDUCTION_CATEGORIES,
  MONTHLY_PNL_EXPENSE_CATEGORIES,
  type MonthlyPnLDeductionCategory,
  type MonthlyPnLExpenseCategory,
  isVendorPayableCategory,
} from '@/lib/finance/monthly-pnl';

export const dynamic = 'force-dynamic';

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

function nextMonthStartIso(period: string): string {
  const d = new Date(`${period}-01T12:00:00`);
  d.setMonth(d.getMonth() + 1);
  return monthStartIso(monthKeyFromDate(d));
}

function addMonths(period: string, delta: number): string {
  const d = new Date(`${period}-01T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  return monthKeyFromDate(d);
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function toDeductionRecord(
  source: Record<string, number>,
): Record<MonthlyPnLDeductionCategory, number> {
  return {
    'Square Fees': Number(source['Square Fees'] ?? 0),
    TX: Number(source.TX ?? 0),
    'Delivery Fee': Number(source['Delivery Fee'] ?? 0),
    Marketing: Number(source.Marketing ?? 0),
  };
}

export default async function BranchFinancialsPage({
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
  const nextMonthStart = nextMonthStartIso(selectedPeriod);
  const previousPeriod = addMonths(selectedPeriod, -1);

  const supabase = await createClient();

  const [{ data: branch }, { data: salesRows }, { data: expenseRows }, { data: vendorInvoiceRows }] =
    await Promise.all([
    supabase.from('branches').select('name').eq('id', id).single(),
    supabase
      .from('sales')
      .select('total_revenue')
      .eq('branch_id', id)
      .gte('sale_date', selectedStart)
      .lte('sale_date', selectedEnd),
    supabase
      .from('branch_monthly_expenses')
      .select('category, amount, receipt_url')
      .eq('branch_id', id)
      .eq('month_period', selectedPeriod),
    supabase
      .from('vendor_invoices')
      .select('vendor_name, amount')
      .eq('branch_id', id)
      .gte('invoice_date', selectedStart)
      .lte('invoice_date', selectedEnd),
  ]);

  if (!branch) notFound();

  const grossSales = (salesRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_revenue ?? 0) || 0),
    0,
  );

  const expenseMap = new Map<
    string,
    {
      amount: number;
      receiptUrl: string | null;
    }
  >();

  for (const row of expenseRows ?? []) {
    const category = String(row.category ?? '');
    expenseMap.set(category, {
      amount: Number(row.amount ?? 0) || 0,
      receiptUrl: row.receipt_url ? String(row.receipt_url) : null,
    });
  }

  const vendorTotals = new Map<string, number>();
  for (const row of vendorInvoiceRows ?? []) {
    const vendorName = String(row.vendor_name ?? '');
    const current = vendorTotals.get(vendorName) ?? 0;
    vendorTotals.set(vendorName, current + (Number(row.amount ?? 0) || 0));
  }

  const { data: laborSnapshots } = await supabase
    .from('branch_staff_compensation_history')
    .select('staff_id, base_salary, recorded_at')
    .eq('branch_id', id)
    .gte('effective_month', selectedStart)
    .lt('effective_month', nextMonthStart)
    .order('recorded_at', { ascending: false });

  let laborAutoFill = 0;
  if ((laborSnapshots ?? []).length > 0) {
    const latestByStaff = new Map<string, number>();
    for (const row of laborSnapshots ?? []) {
      const staffId = String(row.staff_id ?? '');
      if (!staffId || latestByStaff.has(staffId)) continue;
      latestByStaff.set(staffId, Number(row.base_salary ?? 0) || 0);
    }
    laborAutoFill = Array.from(latestByStaff.values()).reduce((sum, value) => sum + value, 0);
  } else {
    const { data: activeStaffRows } = await supabase
      .from('branch_staff')
      .select('base_salary')
      .eq('branch_id', id)
      .eq('status', 'active');

    laborAutoFill = (activeStaffRows ?? []).reduce(
      (sum, row) => sum + (Number(row.base_salary ?? 0) || 0),
      0,
    );
  }

  const { data: warehouseInvoiceRows } = await supabase
    .from('warehouse_invoices')
    .select('total_amount')
    .eq('branch_id', id)
    .lte('billing_period_start', selectedEnd)
    .gte('billing_period_end', selectedStart);

  const warehouseAutoFill = (warehouseInvoiceRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount ?? 0) || 0),
    0,
  );

  const expenseTableRows = MONTHLY_PNL_EXPENSE_CATEGORIES.map((category) => {
    const record = expenseMap.get(category);
    const fallbackAmount = record?.amount ?? 0;
    const isLabor = category === 'Labor';
    const isWarehouse = category === 'Warehouse';
    const isVendorCategory = isVendorPayableCategory(category);
    const vendorAmount = vendorTotals.get(category) ?? 0;
    const amount = isLabor
      ? laborAutoFill
      : isWarehouse
        ? warehouseAutoFill
        : isVendorCategory
          ? vendorAmount
          : fallbackAmount;
    const readOnly = isLabor || isWarehouse || isVendorCategory;
    const helperLinkHref = isLabor
      ? `/branch/${id}/staffing`
      : isWarehouse
        ? `/branch/${id}/warehouse`
        : isVendorCategory
          ? `/branch/${id}/vendors?period=${selectedPeriod}`
          : undefined;
    const helperLinkLabel = isLabor
      ? 'View Payroll'
      : isWarehouse
        ? 'View Warehouse'
        : isVendorCategory
          ? 'View Vendors'
          : undefined;

    return {
      category: category as MonthlyPnLExpenseCategory,
      amount: Number(amount.toFixed(2)),
      receiptUrl: record?.receiptUrl ?? null,
      readOnly,
      helperLinkHref,
      helperLinkLabel,
    };
  });

  const deductionSource: Record<string, number> = {};
  for (const category of MONTHLY_PNL_DEDUCTION_CATEGORIES) {
    deductionSource[category] = expenseMap.get(category)?.amount ?? 0;
  }
  const deductionValues = toDeductionRecord(deductionSource);

  const totalDeductions = MONTHLY_PNL_DEDUCTION_CATEGORIES.reduce(
    (sum, category) => sum + Number(deductionValues[category] ?? 0),
    0,
  );
  const netTotal = grossSales - totalDeductions;
  const totalExpenses = expenseTableRows.reduce((sum, row) => sum + row.amount, 0);
  const finalPnL = netTotal - totalExpenses;
  const vendorCogs = expenseTableRows
    .filter((row) =>
      ['US Foods', 'Lenard Paper', 'PFG', "Keany's", 'Bread', 'Warehouse'].includes(row.category),
    )
    .reduce((sum, row) => sum + row.amount, 0);
  const netMargin = percentage(finalPnL, grossSales);
  const foodCostPct = percentage(vendorCogs, grossSales);
  const laborCostPct = percentage(laborAutoFill, grossSales);

  const previousStart = monthStartIso(previousPeriod);
  const previousEnd = monthEndIso(previousPeriod);
  const { data: previousSalesRows } = await supabase
    .from('sales')
    .select('total_revenue')
    .eq('branch_id', id)
    .gte('sale_date', previousStart)
    .lte('sale_date', previousEnd);

  const previousGrossSales = (previousSalesRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_revenue ?? 0) || 0),
    0,
  );
  const previousNetTotal = previousGrossSales;
  const previousFinalPnL = previousNetTotal;

  const insights = await generateFinancialCommentary({
    focus: 'financial',
    period: selectedPeriod,
    branchName: String(branch.name ?? ''),
    context: {
      grossSales,
      netProfit: finalPnL,
      netMarginPct: netMargin,
      cogs: vendorCogs,
      foodCostPct,
      laborCost: laborAutoFill,
      laborCostPct,
      opEx: totalExpenses,
      opExPct: percentage(totalExpenses, grossSales),
      previousGrossSales,
      previousNetProfit: previousFinalPnL,
      previousNetMarginPct: percentage(previousFinalPnL, previousGrossSales),
      previousFoodCostPct: percentage(previousNetTotal, previousGrossSales),
      netTotal,
      deductionsTotal: totalDeductions,
      topDriver:
        [...expenseTableRows].sort((a, b) => b.amount - a.amount)[0]?.category ?? 'Labor',
      topDriverDelta: 0,
      openAlertsCount: 0,
      checklistCount: 0,
      qualityAverage: 0,
    },
  });

  const monthLabel = new Date(`${selectedPeriod}-01T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-full" dir="ltr">
      <FinancialsDashboardClient
        branchId={id}
        branchName={String(branch.name ?? '').toUpperCase()}
        monthLabel={monthLabel}
        selectedPeriod={selectedPeriod}
        monthHrefPrev={`/branch/${id}/financials?period=${addMonths(selectedPeriod, -1)}`}
        monthHrefNext={`/branch/${id}/financials?period=${addMonths(selectedPeriod, 1)}`}
        varianceHref={`/branch/${id}/financials/variance?period=${selectedPeriod}`}
        grossSales={grossSales}
        insights={insights}
        initialRows={expenseTableRows}
        initialDeductions={deductionValues}
      />
    </div>
  );
}
