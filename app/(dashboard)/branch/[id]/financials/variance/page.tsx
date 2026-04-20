import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ExecutiveVarianceDashboard } from '@/components/finance/ExecutiveVarianceDashboard';
import { generateFinancialCommentary } from '@/lib/ai/financial-commentary';
import {
  MONTHLY_PNL_EXPENSE_CATEGORIES,
  type MonthlyPnLExpenseCategory,
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
  if (total <= 0) return value > 0 ? 100 : 0;
  return (value / total) * 100;
}

function mapIngredientToCategory(name: string): MonthlyPnLExpenseCategory {
  const normalized = name.toLowerCase();
  if (normalized.includes('bread')) return 'Bread';
  if (normalized.includes('paper') || normalized.includes('packag')) return 'Lenard Paper';
  if (normalized.includes('keany') || normalized.includes('produce')) return "Keany's";
  if (normalized.includes('pfg')) return 'PFG';
  if (normalized.includes('warehouse') || normalized.includes('commissary')) return 'Warehouse';
  return 'US Foods';
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
  const selectedPeriod = /^\d{4}-\d{2}$/.test(String(sp.period ?? ''))
    ? String(sp.period)
    : monthKeyNow();
  const selectedStart = monthStartIso(selectedPeriod);
  const selectedEnd = monthEndIso(selectedPeriod);
  const nextMonthStart = nextMonthStartIso(selectedPeriod);

  const supabase = await createClient();
  const { data: branch } = await supabase
    .from('branches')
    .select('name')
    .eq('id', id)
    .single();
  if (!branch) notFound();

  const [{ data: salesRowsCurrent }, { data: expenseRows }, { data: warehouseInvoiceRows }, { data: laborSnapshots }] =
    await Promise.all([
      supabase
        .from('sales')
        .select('recipe_id, quantity_sold, total_revenue')
        .eq('branch_id', id)
        .gte('sale_date', selectedStart)
        .lte('sale_date', selectedEnd),
      supabase
        .from('branch_monthly_expenses')
        .select('category, amount')
        .eq('branch_id', id)
        .eq('month_period', selectedPeriod),
      supabase
        .from('warehouse_invoices')
        .select('total_amount')
        .eq('branch_id', id)
        .lte('billing_period_start', selectedEnd)
        .gte('billing_period_end', selectedStart),
      supabase
        .from('branch_staff_compensation_history')
        .select('staff_id, base_salary, recorded_at')
        .eq('branch_id', id)
        .gte('effective_month', selectedStart)
        .lt('effective_month', nextMonthStart)
        .order('recorded_at', { ascending: false }),
    ]);

  const grossSales = (salesRowsCurrent ?? []).reduce(
    (sum, row) => sum + (Number(row.total_revenue ?? 0) || 0),
    0,
  );

  const recipeIds = Array.from(new Set((salesRowsCurrent ?? []).map((row) => String(row.recipe_id))));
  const { data: recipeItemsRows } =
    recipeIds.length > 0
      ? await supabase
          .from('recipe_items')
          .select('recipe_id, quantity_grams, ingredients(name, cost_per_unit)')
          .in('recipe_id', recipeIds)
      : { data: [] };

  const salesByRecipe = new Map<string, number>();
  for (const row of salesRowsCurrent ?? []) {
    const recipeId = String(row.recipe_id);
    const qty = Number(row.quantity_sold ?? 0) || 0;
    salesByRecipe.set(recipeId, (salesByRecipe.get(recipeId) ?? 0) + qty);
  }

  const idealCostByCategory = new Map<MonthlyPnLExpenseCategory, number>();
  for (const category of MONTHLY_PNL_EXPENSE_CATEGORIES) idealCostByCategory.set(category, 0);

  for (const row of recipeItemsRows ?? []) {
    const recipeId = String(row.recipe_id);
    const soldQty = salesByRecipe.get(recipeId) ?? 0;
    if (soldQty <= 0) continue;
    const ingredient = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    const ingredientName = String(ingredient?.name ?? 'US Foods');
    const costPerUnit = Number(ingredient?.cost_per_unit ?? 0) || 0;
    const quantityGrams = Number(row.quantity_grams ?? 0) || 0;
    const theoreticalCost = soldQty * quantityGrams * costPerUnit;
    const category = mapIngredientToCategory(ingredientName);
    idealCostByCategory.set(category, (idealCostByCategory.get(category) ?? 0) + theoreticalCost);
  }

  const benchmarkRatios: Record<MonthlyPnLExpenseCategory, number> = {
    Royalty: 0.06,
    'US Foods': 0,
    'Lenard Paper': 0,
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
    'Hood Cleaning': 0.006,
    Maintenance: 0.012,
  };

  for (const category of MONTHLY_PNL_EXPENSE_CATEGORIES) {
    if ((idealCostByCategory.get(category) ?? 0) > 0) continue;
    const ratio = benchmarkRatios[category];
    if (ratio > 0) {
      idealCostByCategory.set(category, grossSales * ratio);
    }
  }

  const actualCostByCategory = new Map<MonthlyPnLExpenseCategory, number>();
  for (const category of MONTHLY_PNL_EXPENSE_CATEGORIES) actualCostByCategory.set(category, 0);

  for (const row of expenseRows ?? []) {
    const category = String(row.category ?? '') as MonthlyPnLExpenseCategory;
    if (!MONTHLY_PNL_EXPENSE_CATEGORIES.includes(category)) continue;
    actualCostByCategory.set(category, Number(row.amount ?? 0) || 0);
  }

  let laborFallback = 0;
  const latestByStaff = new Map<string, number>();
  for (const row of laborSnapshots ?? []) {
    const staffId = String(row.staff_id ?? '');
    if (!staffId || latestByStaff.has(staffId)) continue;
    latestByStaff.set(staffId, Number(row.base_salary ?? 0) || 0);
  }
  laborFallback = Array.from(latestByStaff.values()).reduce((sum, value) => sum + value, 0);
  if ((actualCostByCategory.get('Labor') ?? 0) <= 0) {
    actualCostByCategory.set('Labor', laborFallback);
  }

  const warehouseFallback = (warehouseInvoiceRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount ?? 0) || 0),
    0,
  );
  if ((actualCostByCategory.get('Warehouse') ?? 0) <= 0) {
    actualCostByCategory.set('Warehouse', warehouseFallback);
  }

  const matrixRows = MONTHLY_PNL_EXPENSE_CATEGORIES.map((category) => {
    const idealCost = Number((idealCostByCategory.get(category) ?? 0).toFixed(2));
    const actualCost = Number((actualCostByCategory.get(category) ?? 0).toFixed(2));
    const variance = Number((actualCost - idealCost).toFixed(2));
    const variancePercent = percentage(variance, idealCost);
    return {
      ingredient: category,
      unit: '$',
      idealUsage: idealCost,
      actualUsage: actualCost,
      varianceAmount: variance,
      variancePercent,
      monetaryVariance: variance,
    };
  }).sort((a, b) => Math.abs(b.monetaryVariance) - Math.abs(a.monetaryVariance));

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
    focus: 'variance',
    period: selectedPeriod,
    branchName: String(branch.name ?? ''),
    context: {
      grossSales,
      netProfit,
      netMarginPct: netMargin,
      cogs: totalActualCost,
      foodCostPct: percentage(totalActualCost, grossSales),
      laborCostPct: percentage(actualCostByCategory.get('Labor') ?? 0, grossSales),
      highRiskVarianceItems: matrixRows.filter((row) => row.variancePercent > 5).length,
      topLossName: primaryLoss?.ingredient ?? 'No dominant category',
      topLossValue: primaryLoss?.monetaryVariance ?? 0,
      idealTotal: totalIdealCost,
      actualTotal: totalActualCost,
      topLossSources: fallbackLossSources,
    },
  });

  const monthLabel = new Date(`${selectedPeriod}-01T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-full" dir="ltr">
      <ExecutiveVarianceDashboard
        branchName={String(branch.name ?? '').toUpperCase()}
        selectedPeriod={selectedPeriod}
        monthLabel={monthLabel}
        monthHrefPrev={`/branch/${id}/financials/variance?period=${addMonths(selectedPeriod, -1)}`}
        monthHrefNext={`/branch/${id}/financials/variance?period=${addMonths(selectedPeriod, 1)}`}
        financialsHref={`/branch/${id}/financials/performance?period=${selectedPeriod}`}
        topLossSources={fallbackLossSources}
        matrixRows={matrixRows}
        insights={insights}
      />
    </div>
  );
}
