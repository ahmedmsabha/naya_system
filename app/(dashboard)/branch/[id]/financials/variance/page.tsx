import { createClient } from "@/lib/supabase/server";
import { requireBranchRow } from "@/lib/branch/require-branch-or-redirect";
import { ExecutiveVarianceDashboard } from "@/components/finance/ExecutiveVarianceDashboard";
import { generateFinancialCommentary } from "@/lib/ai/financial-commentary";
import { addMonths, monthEndIso, monthKeyNow, monthLabel, monthStartIso, nextMonthStartIso, parsePeriod } from "@/lib/domain/date";
import { DEFAULT_VARIANCE_BENCHMARK_RATIOS } from "@/lib/finance/variance-benchmarks";
import {
  aggregateSalesQuantityByRecipe,
  applyBenchmarkIdealFill,
  applyLaborAndWarehouseActualFallbacks,
  buildVarianceMatrixRows,
  computeTheoreticalCostByCategory,
  mergeLedgerRowsIntoActualMap,
  sumLatestLaborFromSnapshots,
  type RecipeItemWithIngredient,
  type SalesRow,
} from "@/lib/finance/variance-aggregation";

export const dynamic = "force-dynamic";

function percentage(value: number, total: number): number {
  if (total <= 0) return value > 0 ? 100 : 0;
  return (value / total) * 100;
}

export default async function FinancialVariancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const rawPeriod = sp.period;
  const periodParam = Array.isArray(rawPeriod) ? rawPeriod[0] : rawPeriod;
  const selectedPeriod = parsePeriod(periodParam, monthKeyNow());
  const selectedStart = monthStartIso(selectedPeriod);
  const selectedEnd = monthEndIso(selectedPeriod);
  const nextMonthStart = nextMonthStartIso(selectedPeriod);

  const branchRow = await requireBranchRow(id, (canonicalId) =>
    `/branch/${canonicalId}/financials/variance?period=${encodeURIComponent(selectedPeriod)}`,
  );

  const supabase = await createClient();

  const [{ data: salesRowsCurrent }, { data: expenseRows }, { data: warehouseInvoiceRows }, { data: laborSnapshots }] =
    await Promise.all([
      supabase
        .from("sales")
        .select("recipe_id, quantity_sold, total_revenue")
        .eq("branch_id", branchRow.id)
        .gte("sale_date", selectedStart)
        .lte("sale_date", selectedEnd),
      supabase
        .from("branch_monthly_expenses")
        .select("category, amount")
        .eq("branch_id", branchRow.id)
        .eq("month_period", selectedPeriod),
      supabase
        .from("warehouse_invoices")
        .select("total_amount")
        .eq("branch_id", branchRow.id)
        .lte("billing_period_start", selectedEnd)
        .gte("billing_period_end", selectedStart),
      supabase
        .from("branch_staff_compensation_history")
        .select("staff_id, base_salary, recorded_at")
        .eq("branch_id", branchRow.id)
        .gte("effective_month", selectedStart)
        .lt("effective_month", nextMonthStart)
        .order("recorded_at", { ascending: false }),
    ]);

  const grossSales = (salesRowsCurrent ?? []).reduce(
    (sum, row) => sum + (Number(row.total_revenue ?? 0) || 0),
    0,
  );

  const recipeIds = Array.from(new Set((salesRowsCurrent ?? []).map((row) => String(row.recipe_id))));
  const { data: recipeItemsRows } =
    recipeIds.length > 0
      ? await supabase
          .from("recipe_items")
          .select("recipe_id, quantity_grams, ingredients(name, cost_per_unit, unit)")
          .in("recipe_id", recipeIds)
      : { data: [] as RecipeItemWithIngredient[] };

  const salesByRecipe = aggregateSalesQuantityByRecipe(salesRowsCurrent as SalesRow[]);

  const idealCostByCategory = computeTheoreticalCostByCategory(
    (recipeItemsRows ?? []) as RecipeItemWithIngredient[],
    salesByRecipe,
  );

  applyBenchmarkIdealFill(idealCostByCategory, grossSales, DEFAULT_VARIANCE_BENCHMARK_RATIOS);

  const actualCostByCategory = mergeLedgerRowsIntoActualMap(expenseRows);

  const laborFallback = sumLatestLaborFromSnapshots(laborSnapshots ?? []);
  const warehouseFallback = (warehouseInvoiceRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount ?? 0) || 0),
    0,
  );
  applyLaborAndWarehouseActualFallbacks(actualCostByCategory, laborFallback, warehouseFallback);

  const matrixRows = buildVarianceMatrixRows(idealCostByCategory, actualCostByCategory);

  const topLossSources = matrixRows
    .filter((row) => row.monetaryVariance > 0)
    .sort((a, b) => b.monetaryVariance - a.monetaryVariance)
    .slice(0, 5)
    .map((row) => ({
      ingredient: row.ingredient,
      monetaryVariance: row.monetaryVariance,
      variancePercent: row.variancePercent,
    }));

  const fallbackLossSources =
    topLossSources.length > 0
      ? topLossSources
      : matrixRows.slice(0, 5).map((row) => ({
          ingredient: row.ingredient,
          monetaryVariance: Math.abs(row.monetaryVariance),
          variancePercent: row.variancePercent,
        }));

  const totalIdealCost = matrixRows.reduce((sum, row) => sum + row.idealUsage, 0);
  const totalActualCost = matrixRows.reduce((sum, row) => sum + row.actualUsage, 0);
  const netProfit = grossSales - totalActualCost;
  const netMargin = percentage(netProfit, grossSales);

  const primaryLoss = fallbackLossSources[0];
  const insights = await generateFinancialCommentary({
    focus: "variance",
    period: selectedPeriod,
    branchName: branchRow.name,
    context: {
      grossSales,
      netProfit,
      netMarginPct: netMargin,
      cogs: totalActualCost,
      foodCostPct: percentage(totalActualCost, grossSales),
      laborCostPct: percentage(actualCostByCategory.get("Labor") ?? 0, grossSales),
      highRiskVarianceItems: matrixRows.filter((row) => row.variancePercent > 5).length,
      topLossName: primaryLoss?.ingredient ?? "No dominant category",
      topLossValue: primaryLoss?.monetaryVariance ?? 0,
      idealTotal: totalIdealCost,
      actualTotal: totalActualCost,
      topLossSources: fallbackLossSources,
    },
  });

  const monthLabelText = monthLabel(selectedPeriod);

  return (
    <div className="w-full" dir="ltr">
      <ExecutiveVarianceDashboard
        branchName={branchRow.name.toUpperCase()}
        selectedPeriod={selectedPeriod}
        monthLabel={monthLabelText}
        monthHrefPrev={`/branch/${branchRow.id}/financials/variance?period=${addMonths(selectedPeriod, -1)}`}
        monthHrefNext={`/branch/${branchRow.id}/financials/variance?period=${addMonths(selectedPeriod, 1)}`}
        financialsHref={`/branch/${branchRow.id}/financials/performance?period=${selectedPeriod}`}
        topLossSources={fallbackLossSources}
        matrixRows={matrixRows}
        insights={insights}
      />
    </div>
  );
}
