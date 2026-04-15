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

export function isVendorPayableCategory(input: string): input is VendorPayableCategory {
  return VENDOR_PAYABLE_CATEGORIES.includes(input as VendorPayableCategory);
}
