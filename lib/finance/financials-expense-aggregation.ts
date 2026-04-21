import {
  MONTHLY_PNL_EXPENSE_CATEGORIES,
  type MonthlyPnLExpenseCategory,
  isCogsExpenseCategory,
  isVendorPayableCategory,
} from "@/lib/finance/monthly-pnl";

export type WeeklySalesPoint = {
  label: string;
  delivery: number;
  takeaway: number;
};

export type GrossSalesAndChannels = {
  grossSales: number;
  averageTicket: number;
  deliverySales: number;
  dineInSales: number;
  weeklySalesSeries: WeeklySalesPoint[];
};

export type SalesRowInput = {
  total_revenue?: unknown;
  quantity_sold?: unknown;
  sale_date?: unknown;
  source?: unknown;
};

export type ManualExpenseRecord = {
  amount: number;
  receiptUrl: string | null;
};

/** Raw `branch_monthly_expenses` rows keyed by category label. */
export type ManualExpensesByCategory = Map<string, ManualExpenseRecord>;

/**
 * System-computed expense totals for Labor, Warehouse, and vendor-invoice categories.
 * These always take precedence over `branch_monthly_expenses.amount` for those rows.
 */
export type AutomatedExpenses = {
  laborCost: number;
  warehouseCost: number;
  /** Sum of `vendor_invoices.amount` grouped by `vendor_name` (matches P&amp;L category label). */
  vendorPayablesByCategory: Map<string, number>;
};

export type ExpenseReadOnlyReason = "labor_payroll" | "warehouse_invoices" | "vendor_invoices";

export type MergedFinancialExpenseRow = {
  category: MonthlyPnLExpenseCategory;
  amount: number;
  receiptUrl: string | null;
  readOnly: boolean;
  /** Present when `readOnly` is true so the table can explain automation. */
  readOnlyReason?: ExpenseReadOnlyReason;
  /**
   * When automation wins, the manual `branch_monthly_expenses.amount` that was not used for this row (if any).
   */
  supersededManualAmount?: number;
  helperLinkHref?: string;
  helperLinkLabel?: string;
};

/**
 * Disjoint pieces used for EBITDA: COGS from vendors + warehouse, payroll, manual OPEX lines,
 * and vendor-invoice OPEX that is not classified as COGS (utilities, rent, etc.).
 */
export type EbitdaComponents = {
  automated_cogs: number;
  labor_cost: number;
  /** Categories that remain fully editable (e.g. Royalty) — amounts from `branch_monthly_expenses` only. */
  manual_opex: number;
  /** Vendor-managed, non-COGS spend from `vendor_invoices` (Gas, Rent, …). */
  automated_vendor_opex: number;
};

function toNumber(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function classifyChannel(source: string): "delivery" | "dine_in" | "takeaway" {
  const s = source.toLowerCase();
  if (/delivery|uber|doordash|talabat|careem|glovo/.test(s)) return "delivery";
  if (/dine|counter|in_store|instore|pos/.test(s)) return "dine_in";
  return "takeaway";
}

/**
 * Aggregates gross sales, ticket, channel splits, and weekly buckets from raw `sales` rows.
 */
export function getGrossSalesAndChannelsFromRows(
  salesRows: SalesRowInput[] | null | undefined,
): GrossSalesAndChannels {
  const rows = salesRows ?? [];
  const grossSales = rows.reduce((sum, row) => sum + toNumber(row.total_revenue), 0);
  const totalQty = rows.reduce((sum, row) => sum + toNumber(row.quantity_sold), 0);
  const averageTicket = totalQty > 0 ? grossSales / totalQty : 0;

  const weeklySalesSeries: WeeklySalesPoint[] = [
    { label: "Week 1", delivery: 0, takeaway: 0 },
    { label: "Week 2", delivery: 0, takeaway: 0 },
    { label: "Week 3", delivery: 0, takeaway: 0 },
    { label: "Week 4", delivery: 0, takeaway: 0 },
  ];

  let deliverySales = 0;
  let dineInSales = 0;
  for (const row of rows) {
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

  return {
    grossSales,
    averageTicket,
    deliverySales,
    dineInSales,
    weeklySalesSeries,
  };
}

function round2(n: number): number {
  return Number(n.toFixed(2));
}

/**
 * Merges manual monthly expense lines with automated labor, warehouse, and vendor-invoice totals.
 *
 * **Priority (same as legacy dashboard):**
 * 1. **Labor** — payroll snapshot (`branch_staff_compensation_history`) or active `branch_staff`; manual Labor ignored for amount.
 * 2. **Warehouse** — overlapping `warehouse_invoices` for the month; manual Warehouse ignored for amount.
 * 3. **Vendor-payable categories** (`isVendorPayableCategory`) — sum of `vendor_invoices` where `vendor_name` matches the
 *    category label; manual `branch_monthly_expenses` amount is **ignored** for the displayed total (see `supersededManualAmount`).
 * 4. **All other categories** — `branch_monthly_expenses.amount` only.
 */
export function mergeManualAndAutomatedExpenseRows(params: {
  branchId: string;
  monthPeriod: string;
  manual: ManualExpensesByCategory;
  automated: AutomatedExpenses;
}): { rows: MergedFinancialExpenseRow[]; ebitdaComponents: EbitdaComponents; totalExpenses: number } {
  const { branchId, monthPeriod, manual, automated } = params;

  const rows: MergedFinancialExpenseRow[] = MONTHLY_PNL_EXPENSE_CATEGORIES.map((category) => {
    const manualRecord = manual.get(category);
    const manualAmount = manualRecord?.amount ?? 0;
    const receiptUrl = manualRecord?.receiptUrl ?? null;

    const isLabor = category === "Labor";
    const isWarehouse = category === "Warehouse";
    const isVendorCategory = isVendorPayableCategory(category);

    let amount = manualAmount;
    let readOnly = false;
    let readOnlyReason: ExpenseReadOnlyReason | undefined;
    let supersededManualAmount: number | undefined;

    if (isLabor) {
      amount = automated.laborCost;
      readOnly = true;
      readOnlyReason = "labor_payroll";
      if (manualAmount > 0) supersededManualAmount = manualAmount;
    } else if (isWarehouse) {
      amount = automated.warehouseCost;
      readOnly = true;
      readOnlyReason = "warehouse_invoices";
      if (manualAmount > 0) supersededManualAmount = manualAmount;
    } else if (isVendorCategory) {
      amount = automated.vendorPayablesByCategory.get(category) ?? 0;
      readOnly = true;
      readOnlyReason = "vendor_invoices";
      if (manualAmount > 0) supersededManualAmount = manualAmount;
    }

    const helperLinkHref = isLabor
      ? `/branch/${branchId}/staffing`
      : isWarehouse
        ? `/branch/${branchId}/warehouse`
        : isVendorCategory
          ? `/branch/${branchId}/vendors?period=${monthPeriod}`
          : undefined;
    const helperLinkLabel = isLabor
      ? "View Payroll"
      : isWarehouse
        ? "View Warehouse"
        : isVendorCategory
          ? "View Vendors"
          : undefined;

    return {
      category,
      amount: round2(amount),
      receiptUrl,
      readOnly,
      readOnlyReason,
      supersededManualAmount,
      helperLinkHref,
      helperLinkLabel,
    };
  });

  let automated_cogs = 0;
  let labor_cost = 0;
  let manual_opex = 0;
  let automated_vendor_opex = 0;

  for (const row of rows) {
    const cat = row.category;
    if (cat === "Labor") {
      labor_cost += row.amount;
    } else if (isCogsExpenseCategory(cat)) {
      automated_cogs += row.amount;
    } else if (row.readOnly && row.readOnlyReason === "vendor_invoices") {
      automated_vendor_opex += row.amount;
    } else if (!row.readOnly) {
      manual_opex += row.amount;
    }
  }

  const ebitdaComponents: EbitdaComponents = {
    automated_cogs: round2(automated_cogs),
    labor_cost: round2(labor_cost),
    manual_opex: round2(manual_opex),
    automated_vendor_opex: round2(automated_vendor_opex),
  };

  const totalExpenses = round2(rows.reduce((sum, row) => sum + row.amount, 0));

  return { rows, ebitdaComponents, totalExpenses };
}
