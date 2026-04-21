import type { MonthlyPnLExpenseCategory } from "@/lib/finance/monthly-pnl";

/**
 * Ideal cost as a share of **gross sales** when recipe-level theoretical cost is missing for that line.
 * Tune per tenant or load from DB; keys must match `MonthlyPnLExpenseCategory` labels used in the ledger.
 */
export const DEFAULT_VARIANCE_BENCHMARK_RATIOS: Partial<
  Record<MonthlyPnLExpenseCategory, number>
> = {
  Royalty: 0.06,
  "US Foods": 0,
  "Lenard Paper": 0,
  PFG: 0,
  "Keany's": 0,
  Warehouse: 0,
  Gas: 0.018,
  Power: 0.028,
  Water: 0.01,
  Rent: 0.12,
  Labor: 0.24,
  Bread: 0,
  Ecolab: 0.008,
  "Hood Cleaning": 0.006,
  Maintenance: 0.012,
};
