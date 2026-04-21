import { MONTHLY_PNL_EXPENSE_CATEGORIES } from "@/lib/finance/monthly-pnl";
import type { MonthlyPnLExpenseCategory } from "@/lib/finance/monthly-pnl";
import {
  resolveIngredientExpenseCategory,
  type IngredientCategoryContext,
} from "@/lib/finance/ingredient-category-mapping";

function percentage(value: number, total: number): number {
  if (total <= 0) return value > 0 ? 100 : 0;
  return (value / total) * 100;
}

export type SalesRow = {
  recipe_id?: unknown;
  quantity_sold?: unknown;
  total_revenue?: unknown;
};

export function aggregateSalesQuantityByRecipe(salesRows: SalesRow[] | null | undefined): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of salesRows ?? []) {
    const id = String(row.recipe_id ?? "");
    const qty = Number(row.quantity_sold ?? 0) || 0;
    map.set(id, (map.get(id) ?? 0) + qty);
  }
  return map;
}

type IngredientRecord = { name?: unknown; cost_per_unit?: unknown; unit?: unknown; category?: unknown };

export type RecipeItemWithIngredient = {
  recipe_id: unknown;
  quantity_grams: unknown;
  ingredients: IngredientRecord | IngredientRecord[] | null;
};

/**
 * Theoretical ingredient cost by P&amp;L category from recipe_items × sold quantities × cost_per_unit.
 * Preserves existing formula: soldQty × quantity_grams × cost_per_unit per line.
 */
export function computeTheoreticalCostByCategory(
  recipeItemsRows: RecipeItemWithIngredient[] | null | undefined,
  salesByRecipe: Map<string, number>,
  resolveCategory: (ctx: IngredientCategoryContext) => MonthlyPnLExpenseCategory = (ctx) =>
    resolveIngredientExpenseCategory(ctx),
): Map<string, number> {
  const ideal = new Map<string, number>();
  for (const row of recipeItemsRows ?? []) {
    const recipeId = String(row.recipe_id);
    const soldQty = salesByRecipe.get(recipeId) ?? 0;
    if (soldQty <= 0) continue;
    const raw = row.ingredients;
    const ingredient = Array.isArray(raw) ? raw[0] : raw;
    const ing = ingredient as IngredientRecord | null | undefined;
    const name = String(ing?.name ?? "");
    const costPerUnit = Number(ing?.cost_per_unit ?? 0) || 0;
    const quantityGrams = Number(row.quantity_grams ?? 0) || 0;
    const theoreticalCost = soldQty * quantityGrams * costPerUnit;
    const dbCategory =
      ing?.category != null && String(ing.category).trim() !== "" ? String(ing.category) : null;
    const category = resolveCategory({
      name,
      unit: ing?.unit != null ? String(ing.unit) : null,
      dbCategory,
    });
    ideal.set(category, (ideal.get(category) ?? 0) + theoreticalCost);
  }
  return ideal;
}

type BenchmarkRatios = Partial<Record<MonthlyPnLExpenseCategory, number>>;

/**
 * Fills ideal map using benchmark % of sales when that category has no recipe-derived ideal yet.
 */
export function applyBenchmarkIdealFill(
  idealCostByCategory: Map<string, number>,
  grossSales: number,
  benchmarkRatios: BenchmarkRatios,
): void {
  for (const [category, ratio] of Object.entries(benchmarkRatios) as [MonthlyPnLExpenseCategory, number][]) {
    if (ratio == null || ratio <= 0) continue;
    if ((idealCostByCategory.get(category) ?? 0) > 0) continue;
    idealCostByCategory.set(category, grossSales * ratio);
  }
}

/**
 * Builds actual spend by category from `branch_monthly_expenses` rows (last row wins per category).
 * Unknown category strings are kept so multi-tenant / future categories appear without code changes.
 */
export function mergeLedgerRowsIntoActualMap(
  expenseRows: Array<{ category?: unknown; amount?: unknown }> | null | undefined,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of expenseRows ?? []) {
    const category = String(row.category ?? "").trim();
    if (!category) continue;
    map.set(category, Number(row.amount ?? 0) || 0);
  }
  return map;
}

export function applyLaborAndWarehouseActualFallbacks(
  actualByCategory: Map<string, number>,
  laborFallback: number,
  warehouseFallback: number,
): void {
  if ((actualByCategory.get("Labor") ?? 0) <= 0) {
    actualByCategory.set("Labor", laborFallback);
  }
  if ((actualByCategory.get("Warehouse") ?? 0) <= 0) {
    actualByCategory.set("Warehouse", warehouseFallback);
  }
}

/**
 * Preferred order (known P&amp;L lines first), then any remaining keys sorted A–Z.
 */
export function orderedVarianceCategoryKeys(
  ideal: Map<string, number>,
  actual: Map<string, number>,
  preferredOrder: readonly string[] = MONTHLY_PNL_EXPENSE_CATEGORIES,
): string[] {
  const keys = new Set<string>();
  for (const k of ideal.keys()) keys.add(k);
  for (const k of actual.keys()) keys.add(k);
  const ordered: string[] = [];
  for (const c of preferredOrder) {
    if (keys.has(c)) {
      ordered.push(c);
      keys.delete(c);
    }
  }
  const rest = Array.from(keys).sort((a, b) => a.localeCompare(b));
  return [...ordered, ...rest];
}

export type VarianceMatrixRow = {
  ingredient: string;
  unit: string;
  idealUsage: number;
  actualUsage: number;
  varianceAmount: number;
  variancePercent: number;
  monetaryVariance: number;
};

export function buildVarianceMatrixRows(
  idealCostByCategory: Map<string, number>,
  actualCostByCategory: Map<string, number>,
  preferredOrder: readonly string[] = MONTHLY_PNL_EXPENSE_CATEGORIES,
): VarianceMatrixRow[] {
  const categories = orderedVarianceCategoryKeys(idealCostByCategory, actualCostByCategory, preferredOrder);
  return categories
    .map((category) => {
      const idealCost = Number((idealCostByCategory.get(category) ?? 0).toFixed(2));
      const actualCost = Number((actualCostByCategory.get(category) ?? 0).toFixed(2));
      const variance = Number((actualCost - idealCost).toFixed(2));
      const variancePercent = percentage(variance, idealCost);
      return {
        ingredient: category,
        unit: "$",
        idealUsage: idealCost,
        actualUsage: actualCost,
        varianceAmount: variance,
        variancePercent,
        monetaryVariance: variance,
      };
    })
    .sort((a, b) => Math.abs(b.monetaryVariance) - Math.abs(a.monetaryVariance));
}

export type LaborSnapshotRow = { staff_id?: unknown; base_salary?: unknown; recorded_at?: unknown };

export function sumLatestLaborFromSnapshots(snapshots: LaborSnapshotRow[] | null | undefined): number {
  const latestByStaff = new Map<string, number>();
  for (const row of snapshots ?? []) {
    const staffId = String(row.staff_id ?? "");
    if (!staffId || latestByStaff.has(staffId)) continue;
    latestByStaff.set(staffId, Number(row.base_salary ?? 0) || 0);
  }
  return Array.from(latestByStaff.values()).reduce((sum, value) => sum + value, 0);
}
