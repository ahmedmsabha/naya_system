import { cache } from "react";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { addMonths, monthEndIso, monthStartIso, nextMonthStartIso } from "@/lib/domain/date";
import {
  MONTHLY_PNL_DEDUCTION_CATEGORIES,
  MONTHLY_PNL_EXPENSE_CATEGORIES,
  type MonthlyPnLDeductionCategory,
  type MonthlyPnLExpenseCategory,
  isVendorPayableCategory,
} from "@/lib/finance/monthly-pnl";
import { generateFinancialCommentary } from "@/lib/ai/financial-commentary";

type ExpenseRow = {
  category: MonthlyPnLExpenseCategory;
  amount: number;
  receiptUrl: string | null;
  readOnly: boolean;
  helperLinkHref?: string;
  helperLinkLabel?: string;
};

type WeeklySalesPoint = {
  label: string;
  delivery: number;
  takeaway: number;
};

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
  totalDeductions: number;
  totalExpenses: number;
  averageTicket: number;
  deliverySales: number;
  dineInSales: number;
  weeklySalesSeries: WeeklySalesPoint[];
  insights: string[];
  initialRows: ExpenseRow[];
  initialDeductions: Record<MonthlyPnLDeductionCategory, number>;
  recipes: Array<{ id: string; name: string; sellingPrice: number }>;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function classifyChannel(source: string): "delivery" | "dine_in" | "takeaway" {
  const s = source.toLowerCase();
  if (/delivery|uber|doordash|talabat|careem|glovo/.test(s)) return "delivery";
  if (/dine|counter|in_store|instore|pos/.test(s)) return "dine_in";
  return "takeaway";
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

async function loadFinancialsDashboardData(
  branchId: string,
  selectedPeriod: string,
): Promise<FinancialsDashboardData> {
  const access = await authorize({ module: "financials", action: "read", branchId });
  if (!access.ok) notFound();

  const selectedStart = monthStartIso(selectedPeriod);
  const selectedEnd = monthEndIso(selectedPeriod);
  const nextMonthStart = nextMonthStartIso(selectedPeriod);
  const previousPeriod = addMonths(selectedPeriod, -1);
  const previousStart = monthStartIso(previousPeriod);
  const previousEnd = monthEndIso(previousPeriod);

  const supabase = await createClient();
  const [
    { data: branch },
    { data: salesRows },
    { data: expenseRows },
    { data: vendorInvoiceRows },
    { data: recipes },
    { data: previousSalesRows },
  ] = await Promise.all([
    supabase.from("branches").select("name").eq("id", branchId).single(),
    supabase
      .from("sales")
      .select("total_revenue, quantity_sold, sale_date, source")
      .eq("branch_id", branchId)
      .gte("sale_date", selectedStart)
      .lte("sale_date", selectedEnd),
    supabase
      .from("branch_monthly_expenses")
      .select("category, amount, receipt_url")
      .eq("branch_id", branchId)
      .eq("month_period", selectedPeriod),
    supabase
      .from("vendor_invoices")
      .select("vendor_name, amount")
      .eq("branch_id", branchId)
      .gte("invoice_date", selectedStart)
      .lte("invoice_date", selectedEnd),
    supabase.from("recipes").select("id, name, selling_price").eq("is_active", true).order("name"),
    supabase
      .from("sales")
      .select("total_revenue")
      .eq("branch_id", branchId)
      .gte("sale_date", previousStart)
      .lte("sale_date", previousEnd),
  ]);

  if (!branch) notFound();

  const grossSales = (salesRows ?? []).reduce((sum, row) => sum + toNumber(row.total_revenue), 0);
  const totalQty = (salesRows ?? []).reduce((sum, row) => sum + toNumber(row.quantity_sold), 0);
  const averageTicket = totalQty > 0 ? grossSales / totalQty : 0;

  const weeklySalesSeries: WeeklySalesPoint[] = [
    { label: "Week 1", delivery: 0, takeaway: 0 },
    { label: "Week 2", delivery: 0, takeaway: 0 },
    { label: "Week 3", delivery: 0, takeaway: 0 },
    { label: "Week 4", delivery: 0, takeaway: 0 },
  ];

  let deliverySales = 0;
  let dineInSales = 0;
  for (const row of salesRows ?? []) {
    const revenue = toNumber(row.total_revenue);
    const saleDate = String(row.sale_date ?? "");
    const day = Number(saleDate.slice(-2));
    const weekIndex = Number.isFinite(day) ? Math.min(3, Math.max(0, Math.floor((day - 1) / 7))) : 0;
    const channel = classifyChannel(String(row.source ?? "pos"));

    if (channel === "delivery") {
      weeklySalesSeries[weekIndex].delivery += revenue;
      deliverySales += revenue;
    } else {
      weeklySalesSeries[weekIndex].takeaway += revenue;
      if (channel === "dine_in") dineInSales += revenue;
    }
  }

  for (const point of weeklySalesSeries) {
    point.delivery = Number(point.delivery.toFixed(2));
    point.takeaway = Number(point.takeaway.toFixed(2));
  }

  const expenseMap = new Map<string, { amount: number; receiptUrl: string | null }>();
  for (const row of expenseRows ?? []) {
    const category = String(row.category ?? "");
    expenseMap.set(category, {
      amount: toNumber(row.amount),
      receiptUrl: row.receipt_url ? String(row.receipt_url) : null,
    });
  }

  const vendorTotals = new Map<string, number>();
  for (const row of vendorInvoiceRows ?? []) {
    const vendorName = String(row.vendor_name ?? "");
    vendorTotals.set(vendorName, (vendorTotals.get(vendorName) ?? 0) + toNumber(row.amount));
  }

  const { data: laborSnapshots } = await supabase
    .from("branch_staff_compensation_history")
    .select("staff_id, base_salary, recorded_at")
    .eq("branch_id", branchId)
    .gte("effective_month", selectedStart)
    .lt("effective_month", nextMonthStart)
    .order("recorded_at", { ascending: false });

  let laborAutoFill = 0;
  if ((laborSnapshots ?? []).length > 0) {
    const latestByStaff = new Map<string, number>();
    for (const row of laborSnapshots ?? []) {
      const staffId = String(row.staff_id ?? "");
      if (!staffId || latestByStaff.has(staffId)) continue;
      latestByStaff.set(staffId, toNumber(row.base_salary));
    }
    laborAutoFill = Array.from(latestByStaff.values()).reduce((sum, value) => sum + value, 0);
  } else {
    const { data: activeStaffRows } = await supabase
      .from("branch_staff")
      .select("base_salary")
      .eq("branch_id", branchId)
      .eq("status", "active");
    laborAutoFill = (activeStaffRows ?? []).reduce((sum, row) => sum + toNumber(row.base_salary), 0);
  }

  const { data: warehouseInvoiceRows } = await supabase
    .from("warehouse_invoices")
    .select("total_amount")
    .eq("branch_id", branchId)
    .lte("billing_period_start", selectedEnd)
    .gte("billing_period_end", selectedStart);

  const warehouseAutoFill = (warehouseInvoiceRows ?? []).reduce(
    (sum, row) => sum + toNumber(row.total_amount),
    0,
  );

  const initialRows: ExpenseRow[] = MONTHLY_PNL_EXPENSE_CATEGORIES.map((category) => {
    const record = expenseMap.get(category);
    const fallbackAmount = record?.amount ?? 0;
    const isLabor = category === "Labor";
    const isWarehouse = category === "Warehouse";
    const isVendorCategory = isVendorPayableCategory(category);
    const vendorAmount = vendorTotals.get(category) ?? 0;
    const amount = isLabor
      ? laborAutoFill
      : isWarehouse
        ? warehouseAutoFill
        : isVendorCategory
          ? vendorAmount
          : fallbackAmount;

    return {
      category: category as MonthlyPnLExpenseCategory,
      amount: Number(amount.toFixed(2)),
      receiptUrl: record?.receiptUrl ?? null,
      readOnly: isLabor || isWarehouse || isVendorCategory,
      helperLinkHref: isLabor
        ? `/branch/${branchId}/staffing`
        : isWarehouse
          ? `/branch/${branchId}/warehouse`
          : isVendorCategory
            ? `/branch/${branchId}/vendors?period=${selectedPeriod}`
            : undefined,
      helperLinkLabel: isLabor
        ? "View Payroll"
        : isWarehouse
          ? "View Warehouse"
          : isVendorCategory
            ? "View Vendors"
            : undefined,
    };
  });

  const deductionSource: Record<string, number> = {};
  for (const category of MONTHLY_PNL_DEDUCTION_CATEGORIES) {
    deductionSource[category] = expenseMap.get(category)?.amount ?? 0;
  }
  const initialDeductions = toDeductionRecord(deductionSource);

  const totalDeductions = MONTHLY_PNL_DEDUCTION_CATEGORIES.reduce(
    (sum, category) => sum + toNumber(initialDeductions[category]),
    0,
  );
  const netSales = grossSales - totalDeductions;
  const totalExpenses = initialRows.reduce((sum, row) => sum + row.amount, 0);
  const cogs = initialRows
    .filter((row) =>
      ["US Foods", "Lenard Paper", "PFG", "Keany's", "Bread", "Warehouse"].includes(row.category),
    )
    .reduce((sum, row) => sum + row.amount, 0);
  const operationsCost = Math.max(0, totalExpenses - cogs - laborAutoFill);
  const ebitda = netSales - cogs - laborAutoFill - operationsCost;

  const previousGrossSales = (previousSalesRows ?? []).reduce(
    (sum, row) => sum + toNumber(row.total_revenue),
    0,
  );

  const insights = await generateFinancialCommentary({
    focus: "financial",
    period: selectedPeriod,
    branchName: String(branch.name ?? ""),
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
    branchId,
    branchName: String(branch.name ?? "").toUpperCase(),
    selectedPeriod,
    monthHrefPrev: `/branch/${branchId}/financials/performance?period=${addMonths(selectedPeriod, -1)}`,
    monthHrefNext: `/branch/${branchId}/financials/performance?period=${addMonths(selectedPeriod, 1)}`,
    grossSales: Number(grossSales.toFixed(2)),
    netSales: Number(netSales.toFixed(2)),
    cogs: Number(cogs.toFixed(2)),
    laborCost: Number(laborAutoFill.toFixed(2)),
    operationsCost: Number(operationsCost.toFixed(2)),
    ebitda: Number(ebitda.toFixed(2)),
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
