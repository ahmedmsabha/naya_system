import { createClient } from '@/lib/supabase/server';
import {
  VENDOR_PAYABLE_CATEGORIES,
  type MonthlyPnLExpenseCategory,
  type VendorPayableCategory,
} from '@/lib/finance/monthly-pnl';
import { monthEndIso, monthStartIso, nextMonthStartIso, periodFromDateIso } from '@/lib/domain/date';
import { toMoney } from '@/lib/domain/money';

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

function fixed2(value: number): number {
  return toMoney(value);
}

async function upsertCategoryRows(
  supabase: SupabaseServerClient,
  branchId: string,
  monthPeriod: string,
  rows: Array<{ category: MonthlyPnLExpenseCategory; amount: number }>,
): Promise<void> {
  if (rows.length === 0) return;
  await supabase.from('branch_monthly_expenses').upsert(
    rows.map((row) => ({
      branch_id: branchId,
      month_period: monthPeriod,
      category: row.category,
      amount: fixed2(row.amount),
    })),
    { onConflict: 'branch_id,month_period,category' },
  );
}

export function periodKeyFromDateIso(dateIso: string): string {
  return periodFromDateIso(dateIso);
}

export async function syncVendorExpensesForPeriod(
  supabase: SupabaseServerClient,
  branchId: string,
  monthPeriod: string,
): Promise<void> {
  const start = monthStartIso(monthPeriod);
  const end = monthEndIso(monthPeriod);
  const { data: vendorRows } = await supabase
    .from('vendor_invoices')
    .select('vendor_name, amount')
    .eq('branch_id', branchId)
    .gte('invoice_date', start)
    .lte('invoice_date', end);

  const totals = new Map<VendorPayableCategory, number>();
  for (const category of VENDOR_PAYABLE_CATEGORIES) totals.set(category, 0);

  for (const row of vendorRows ?? []) {
    const category = String(row.vendor_name ?? '') as VendorPayableCategory;
    if (!totals.has(category)) continue;
    totals.set(category, (totals.get(category) ?? 0) + (Number(row.amount ?? 0) || 0));
  }

  await upsertCategoryRows(
    supabase,
    branchId,
    monthPeriod,
    VENDOR_PAYABLE_CATEGORIES.map((category) => ({
      category,
      amount: totals.get(category) ?? 0,
    })),
  );
}

export async function syncWarehouseExpenseForPeriod(
  supabase: SupabaseServerClient,
  branchId: string,
  monthPeriod: string,
): Promise<void> {
  const start = monthStartIso(monthPeriod);
  const end = monthEndIso(monthPeriod);

  const { data: warehouseRows } = await supabase
    .from('warehouse_invoices')
    .select('total_amount')
    .eq('branch_id', branchId)
    .lte('billing_period_start', end)
    .gte('billing_period_end', start);

  const total = (warehouseRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount ?? 0) || 0),
    0,
  );

  await upsertCategoryRows(supabase, branchId, monthPeriod, [
    { category: 'Warehouse', amount: total },
  ]);
}

export async function syncLaborExpenseForPeriod(
  supabase: SupabaseServerClient,
  branchId: string,
  monthPeriod: string,
): Promise<void> {
  const start = monthStartIso(monthPeriod);
  const nextStart = nextMonthStartIso(monthPeriod);

  const { data: laborSnapshots } = await supabase
    .from('branch_staff_compensation_history')
    .select('staff_id, base_salary, recorded_at')
    .eq('branch_id', branchId)
    .gte('effective_month', start)
    .lt('effective_month', nextStart)
    .order('recorded_at', { ascending: false });

  let laborTotal = 0;
  if ((laborSnapshots ?? []).length > 0) {
    const latestByStaff = new Map<string, number>();
    for (const row of laborSnapshots ?? []) {
      const staffId = String(row.staff_id ?? '');
      if (!staffId || latestByStaff.has(staffId)) continue;
      latestByStaff.set(staffId, Number(row.base_salary ?? 0) || 0);
    }
    laborTotal = Array.from(latestByStaff.values()).reduce((sum, salary) => sum + salary, 0);
  } else {
    const { data: activeStaffRows } = await supabase
      .from('branch_staff')
      .select('base_salary')
      .eq('branch_id', branchId)
      .eq('status', 'active');
    laborTotal = (activeStaffRows ?? []).reduce(
      (sum, row) => sum + (Number(row.base_salary ?? 0) || 0),
      0,
    );
  }

  await upsertCategoryRows(supabase, branchId, monthPeriod, [
    { category: 'Labor', amount: laborTotal },
  ]);
}

export async function syncAutoFinancialCategoriesForPeriod(
  supabase: SupabaseServerClient,
  branchId: string,
  monthPeriod: string,
): Promise<void> {
  await Promise.all([
    syncVendorExpensesForPeriod(supabase, branchId, monthPeriod),
    syncWarehouseExpenseForPeriod(supabase, branchId, monthPeriod),
    syncLaborExpenseForPeriod(supabase, branchId, monthPeriod),
  ]);
}
