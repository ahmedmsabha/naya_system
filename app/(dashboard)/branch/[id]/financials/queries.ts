import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { requireBranchRow } from "@/lib/branch/require-branch-or-redirect";
import { addMonths, monthEndIso, monthStartIso, nextMonthStartIso } from "@/lib/domain/date";
import {
  getGrossSalesAndChannelsFromRows,
  mergeManualAndAutomatedExpenseRows,
  type AutomatedExpenses,
  type GrossSalesAndChannels,
  type ManualExpensesByCategory,
  type ManualExpenseRecord,
  type MergedFinancialExpenseRow,
  type EbitdaComponents,
} from "@/lib/finance/financials-expense-aggregation";
import {
  MONTHLY_PNL_DEDUCTION_CATEGORIES,
  type MonthlyPnLDeductionCategory,
} from "@/lib/finance/monthly-pnl";
import { generateFinancialCommentary } from "@/lib/ai/financial-commentary";

type SupabaseServer = Awaited<ReturnType<typeof createClient>>;

export type FinancialExpenseRow = MergedFinancialExpenseRow;

type WeeklySalesPoint = GrossSalesAndChannels["weeklySalesSeries"][number];

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function toDeductionRecord(
  source: Record<string, number>,
): Record<MonthlyPnLDeductionCategory, number> {
  return {
    "Square Fees": toNumber(source["Square Fees"]),
    TX: toNumber(source.TX),
    "Delivery Fee": toNumber(source["Delivery Fee"]),
    Marketing: toNumber(source.Marketing),
  };
}

/**
 * Loads `branch_monthly_expenses` for the month. Amounts may be superseded later by automation — see
 * `mergeManualAndAutomatedExpenseRows`.
 */
export async function getManualExpenses(
  supabase: SupabaseServer,
  branchId: string,
  period: string,
): Promise<ManualExpensesByCategory> {
  const { data: expenseRows, error } = await supabase
    .from("branch_monthly_expenses")
    .select("category, amount, receipt_url")
    .eq("branch_id", branchId)
    .eq("month_period", period);

  if (error) throw new Error(error.message);

  const map: ManualExpensesByCategory = new Map();
  for (const row of expenseRows ?? []) {
    const category = String(row.category ?? "");
    map.set(category, {
      amount: toNumber(row.amount),
      receiptUrl: row.receipt_url ? String(row.receipt_url) : null,
    });
  }
  return map;
}

/**
 * Labor (payroll snapshot or active staff), warehouse billing overlap, and vendor invoices for the period.
 * These totals override manual `branch_monthly_expenses` rows for the same categories.
 */
export async function getAutomatedExpenses(
  supabase: SupabaseServer,
  branchId: string,
  selectedStart: string,
  selectedEnd: string,
  nextMonthStart: string,
): Promise<AutomatedExpenses> {
  const { data: vendorInvoiceRows, error: vendorErr } = await supabase
    .from("vendor_invoices")
    .select("vendor_name, amount")
    .eq("branch_id", branchId)
    .gte("invoice_date", selectedStart)
    .lte("invoice_date", selectedEnd);
  if (vendorErr) throw new Error(vendorErr.message);

  const vendorPayablesByCategory = new Map<string, number>();
  for (const row of vendorInvoiceRows ?? []) {
    const vendorName = String(row.vendor_name ?? "");
    vendorPayablesByCategory.set(
      vendorName,
      (vendorPayablesByCategory.get(vendorName) ?? 0) + toNumber(row.amount),
    );
  }

  const { data: laborSnapshots, error: laborErr } = await supabase
    .from("branch_staff_compensation_history")
    .select("staff_id, base_salary, recorded_at")
    .eq("branch_id", branchId)
    .gte("effective_month", selectedStart)
    .lt("effective_month", nextMonthStart)
    .order("recorded_at", { ascending: false });
  if (laborErr) throw new Error(laborErr.message);

  let laborCost = 0;
  if ((laborSnapshots ?? []).length > 0) {
    const latestByStaff = new Map<string, number>();
    for (const row of laborSnapshots ?? []) {
      const staffId = String(row.staff_id ?? "");
      if (!staffId || latestByStaff.has(staffId)) continue;
      latestByStaff.set(staffId, toNumber(row.base_salary));
    }
    laborCost = Array.from(latestByStaff.values()).reduce((sum, value) => sum + value, 0);
  } else {
    const { data: activeStaffRows, error: staffErr } = await supabase
      .from("branch_staff")
      .select("base_salary")
      .eq("branch_id", branchId)
      .eq("status", "active");
    if (staffErr) throw new Error(staffErr.message);
    laborCost = (activeStaffRows ?? []).reduce((sum, row) => sum + toNumber(row.base_salary), 0);
  }

  const { data: warehouseInvoiceRows, error: whErr } = await supabase
    .from("warehouse_invoices")
    .select("total_amount")
    .eq("branch_id", branchId)
    .lte("billing_period_start", selectedEnd)
    .gte("billing_period_end", selectedStart);
  if (whErr) throw new Error(whErr.message);

  const warehouseCost = (warehouseInvoiceRows ?? []).reduce(
    (sum, row) => sum + toNumber(row.total_amount),
    0,
  );

  return {
    laborCost,
    warehouseCost,
    vendorPayablesByCategory,
  };
}

/**
 * Gross sales, channel splits, and weekly buckets for the date range `[start, end]`.
 */
export async function getGrossSalesAndChannels(
  supabase: SupabaseServer,
  branchId: string,
  start: string,
  end: string,
): Promise<GrossSalesAndChannels> {
  const { data: salesRows, error } = await supabase
    .from("sales")
    .select("total_revenue, quantity_sold, sale_date, source")
    .eq("branch_id", branchId)
    .gte("sale_date", start)
    .lte("sale_date", end);
  if (error) throw new Error(error.message);
  return getGrossSalesAndChannelsFromRows(salesRows ?? []);
}

export type FinancialsDashboardData = {
  branchId: string;
  branchName: string;
  selectedPeriod: string;
  monthHrefPrev: string;
  monthHrefNext: string;
  grossSales: number;
  netSales: number;
  cogs: number;
  laborCost: number;
  operationsCost: number;
  ebitda: number;
  /** Disjoint cost buckets for EBITDA (sums match merged expense rows). */
  ebitdaComponents: EbitdaComponents;
  totalDeductions: number;
  totalExpenses: number;
  averageTicket: number;
  deliverySales: number;
  dineInSales: number;
  weeklySalesSeries: WeeklySalesPoint[];
  insights: string[];
  initialRows: FinancialExpenseRow[];
  initialDeductions: Record<MonthlyPnLDeductionCategory, number>;
  recipes: Array<{ id: string; name: string; sellingPrice: number }>;
};

async function loadFinancialsDashboardData(
  branchId: string,
  selectedPeriod: string,
): Promise<FinancialsDashboardData> {
  const access = await authorize({ module: "financials", action: "read", branchId });
  if (!access.ok) notFound();

  const branchRow = await requireBranchRow(branchId, (canonicalId) =>
    `/branch/${canonicalId}/financials/performance?period=${encodeURIComponent(selectedPeriod)}`,
  );

  const selectedStart = monthStartIso(selectedPeriod);
  const selectedEnd = monthEndIso(selectedPeriod);
  const nextMonthStart = nextMonthStartIso(selectedPeriod);
  const previousPeriod = addMonths(selectedPeriod, -1);
  const previousStart = monthStartIso(previousPeriod);
  const previousEnd = monthEndIso(previousPeriod);

  const supabase = await createClient();

  const [
    salesAndChannels,
    manualExpenseMap,
    automated,
    { data: recipes, error: recipesErr },
    { data: previousSalesRows, error: prevSalesErr },
  ] = await Promise.all([
    getGrossSalesAndChannels(supabase, branchRow.id, selectedStart, selectedEnd),
    getManualExpenses(supabase, branchRow.id, selectedPeriod),
    getAutomatedExpenses(supabase, branchRow.id, selectedStart, selectedEnd, nextMonthStart),
    supabase.from("recipes").select("id, name, selling_price").eq("is_active", true).order("name"),
    supabase
      .from("sales")
      .select("total_revenue")
      .eq("branch_id", branchRow.id)
      .gte("sale_date", previousStart)
      .lte("sale_date", previousEnd),
  ]);

  if (recipesErr) throw new Error(recipesErr.message);
  if (prevSalesErr) throw new Error(prevSalesErr.message);

  const {
    grossSales,
    averageTicket,
    deliverySales,
    dineInSales,
    weeklySalesSeries,
  } = salesAndChannels;

  const { rows: initialRows, ebitdaComponents, totalExpenses } = mergeManualAndAutomatedExpenseRows({
    branchId: branchRow.id,
    monthPeriod: selectedPeriod,
    manual: manualExpenseMap,
    automated,
  });

  const deductionSource: Record<string, number> = {};
  for (const category of MONTHLY_PNL_DEDUCTION_CATEGORIES) {
    const rec = manualExpenseMap.get(category) as ManualExpenseRecord | undefined;
    deductionSource[category] = rec?.amount ?? 0;
  }
  const initialDeductions = toDeductionRecord(deductionSource);

  const totalDeductions = MONTHLY_PNL_DEDUCTION_CATEGORIES.reduce(
    (sum, category) => sum + toNumber(initialDeductions[category]),
    0,
  );
  const netSales = grossSales - totalDeductions;

  const cogs = ebitdaComponents.automated_cogs;
  const laborAutoFill = ebitdaComponents.labor_cost;
  const operationsCost = Math.max(
    0,
    ebitdaComponents.manual_opex + ebitdaComponents.automated_vendor_opex,
  );
  const ebitda = netSales - cogs - laborAutoFill - operationsCost;

  const previousGrossSales = (previousSalesRows ?? []).reduce(
    (sum, row) => sum + toNumber(row.total_revenue),
    0,
  );

  const insights = await generateFinancialCommentary({
    focus: "financial",
    period: selectedPeriod,
    branchName: branchRow.name,
    context: {
      grossSales,
      netProfit: ebitda,
      netMarginPct: percentage(ebitda, grossSales),
      cogs,
      foodCostPct: percentage(cogs, grossSales),
      laborCost: laborAutoFill,
      laborCostPct: percentage(laborAutoFill, grossSales),
      opEx: operationsCost,
      opExPct: percentage(operationsCost, grossSales),
      previousGrossSales,
      previousNetProfit: previousGrossSales,
      previousNetMarginPct: percentage(previousGrossSales, previousGrossSales),
      previousFoodCostPct: percentage(previousGrossSales, previousGrossSales),
      netTotal: netSales,
      deductionsTotal: totalDeductions,
      topDriver: [...initialRows].sort((a, b) => b.amount - a.amount)[0]?.category ?? "Labor",
      topDriverDelta: 0,
      openAlertsCount: 0,
      checklistCount: 0,
      qualityAverage: 0,
    },
  });

  return {
    branchId: branchRow.id,
    branchName: branchRow.name.toUpperCase(),
    selectedPeriod,
    monthHrefPrev: `/branch/${branchRow.id}/financials/performance?period=${addMonths(selectedPeriod, -1)}`,
    monthHrefNext: `/branch/${branchRow.id}/financials/performance?period=${addMonths(selectedPeriod, 1)}`,
    grossSales: Number(grossSales.toFixed(2)),
    netSales: Number(netSales.toFixed(2)),
    cogs: Number(cogs.toFixed(2)),
    laborCost: Number(laborAutoFill.toFixed(2)),
    operationsCost: Number(operationsCost.toFixed(2)),
    ebitda: Number(ebitda.toFixed(2)),
    ebitdaComponents: {
      automated_cogs: Number(ebitdaComponents.automated_cogs.toFixed(2)),
      labor_cost: Number(ebitdaComponents.labor_cost.toFixed(2)),
      manual_opex: Number(ebitdaComponents.manual_opex.toFixed(2)),
      automated_vendor_opex: Number(ebitdaComponents.automated_vendor_opex.toFixed(2)),
    },
    totalDeductions: Number(totalDeductions.toFixed(2)),
    totalExpenses: Number(totalExpenses.toFixed(2)),
    averageTicket: Number(averageTicket.toFixed(2)),
    deliverySales: Number(deliverySales.toFixed(2)),
    dineInSales: Number(dineInSales.toFixed(2)),
    weeklySalesSeries,
    insights,
    initialRows,
    initialDeductions,
    recipes: (recipes ?? []).map((recipe) => ({
      id: String(recipe.id),
      name: String(recipe.name ?? ""),
      sellingPrice: toNumber(recipe.selling_price),
    })),
  };
}

/** Deduplicate RSC fetches when layout and pages both request the same branch period. */
export const getFinancialsDashboardData = cache(loadFinancialsDashboardData);
