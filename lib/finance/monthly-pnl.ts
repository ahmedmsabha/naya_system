export const MONTHLY_PNL_EXPENSE_CATEGORIES = [
  'Royalty',
  'US Foods',
  'Lenard Paper',
  'PFG',
  "Keany's",
  'Warehouse',
  'Gas',
  'Power',
  'Water',
  'Rent',
  'Labor',
  'Bread',
  'Ecolab',
  'Hood Cleaning',
  'Maintenance',
] as const;

export const VENDOR_PAYABLE_CATEGORIES = [
  'US Foods',
  'Lenard Paper',
  'PFG',
  "Keany's",
  'Gas',
  'Power',
  'Water',
  'Rent',
  'Bread',
  'Ecolab',
  'Hood Cleaning',
  'Maintenance',
] as const;

export const MONTHLY_PNL_DEDUCTION_CATEGORIES = [
  'Square Fees',
  'TX',
  'Delivery Fee',
  'Marketing',
] as const;

export const MONTHLY_PNL_ALL_CATEGORIES = [
  ...MONTHLY_PNL_EXPENSE_CATEGORIES,
  ...MONTHLY_PNL_DEDUCTION_CATEGORIES,
] as const;

export type MonthlyPnLExpenseCategory = (typeof MONTHLY_PNL_EXPENSE_CATEGORIES)[number];
export type MonthlyPnLDeductionCategory = (typeof MONTHLY_PNL_DEDUCTION_CATEGORIES)[number];
export type MonthlyPnLCategory = (typeof MONTHLY_PNL_ALL_CATEGORIES)[number];
export type VendorPayableCategory = (typeof VENDOR_PAYABLE_CATEGORIES)[number];

export function isMonthlyPnLCategory(input: string): input is MonthlyPnLCategory {
  return MONTHLY_PNL_ALL_CATEGORIES.includes(input as MonthlyPnLCategory);
}

export function isMonthlyPnLExpenseCategory(input: string): input is MonthlyPnLExpenseCategory {
  return (MONTHLY_PNL_EXPENSE_CATEGORIES as readonly string[]).includes(input);
}

export function isVendorPayableCategory(input: string): input is VendorPayableCategory {
  return VENDOR_PAYABLE_CATEGORIES.includes(input as VendorPayableCategory);
}

/**
 * Categories included in the COGS / food-cost rollup for financials and EBITDA (vendor food + warehouse).
 */
export const MONTHLY_PNL_COGS_CATEGORIES = [
  "US Foods",
  "Lenard Paper",
  "PFG",
  "Keany's",
  "Bread",
  "Warehouse",
] as const;

export type MonthlyPnLCogsCategory = (typeof MONTHLY_PNL_COGS_CATEGORIES)[number];

export function isCogsExpenseCategory(input: string): input is MonthlyPnLCogsCategory {
  return (MONTHLY_PNL_COGS_CATEGORIES as readonly string[]).includes(input);
}

/**
 * **Vendor-managed rows (see `isVendorPayableCategory`):**
 * Displayed amounts and EBITDA use **vendor_invoices** aggregated by `vendor_name` matching the P&amp;L category label.
 * Any amount stored in `branch_monthly_expenses` for that category is **not** used for the total (it may be shown as
 * `supersededManualAmount` in the UI for transparency). Same prioritization applies whether or not invoices exist
 * (invoice sum may be $0).
 *
 * **Labor** and **Warehouse** similarly ignore manual table totals in favor of payroll snapshots / warehouse invoices.
 */
export const EXPENSE_SOURCE_PRIORITY_DOC = "vendor_invoices_over_manual" as const;
