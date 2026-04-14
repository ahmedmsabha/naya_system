import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ExecutiveVarianceDashboard } from '@/components/finance/ExecutiveVarianceDashboard';
import { generateFinancialCommentary } from '@/lib/ai/financial-commentary';

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

function addMonths(period: string, delta: number): string {
  const d = new Date(`${period}-01T12:00:00`);
  d.setMonth(d.getMonth() + delta);
  return monthKeyFromDate(d);
}

function percentage(value: number, total: number): number {
  if (total <= 0) return value > 0 ? 100 : 0;
  return (value / total) * 100;
}

function normalizeIngredient(
  ingredient:
    | { name?: string | null; unit?: string | null; cost_per_unit?: number | null }
    | Array<{ name?: string | null; unit?: string | null; cost_per_unit?: number | null }>
    | null,
) {
  if (!ingredient) return null;
  return Array.isArray(ingredient) ? ingredient[0] : ingredient;
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

  const supabase = await createClient();
  const { data: branch } = await supabase
    .from('branches')
    .select('name')
    .eq('id', id)
    .single();
  if (!branch) notFound();

  const { data: salesRowsCurrent } = await supabase
    .from('sales')
    .select('recipe_id, quantity_sold, total_revenue')
    .eq('branch_id', id)
    .gte('sale_date', selectedStart)
    .lte('sale_date', selectedEnd);

  const { data: distributionRowsCurrent } = await supabase
    .from('warehouse_distributions')
    .select('ingredient_id, quantity, ingredients(name, unit, cost_per_unit)')
    .eq('branch_id', id)
    .gte('distributed_at', selectedStart)
    .lte('distributed_at', selectedEnd);

  const recipeIds = Array.from(new Set((salesRowsCurrent ?? []).map((row) => String(row.recipe_id))));
  const { data: recipeItemsRows } =
    recipeIds.length > 0
      ? await supabase
          .from('recipe_items')
          .select('recipe_id, ingredient_id, quantity_grams, ingredients(name, unit, cost_per_unit)')
          .in('recipe_id', recipeIds)
      : { data: [] };

  const [
    { data: warehouseInvoiceRows },
    { data: accountantInvoiceRows },
    { data: payrollRows },
    { count: openAlertsCountRaw },
  ] = await Promise.all([
    supabase
      .from('warehouse_invoices')
      .select('total_amount')
      .eq('branch_id', id)
      .gte('billing_period_start', selectedStart)
      .lte('billing_period_end', selectedEnd),
    supabase
      .from('tarek_invoices')
      .select('amount')
      .gte('created_at', `${selectedStart}T00:00:00`)
      .lte('created_at', `${selectedEnd}T23:59:59`),
    supabase
      .from('branch_staff')
      .select('base_salary')
      .eq('branch_id', id)
      .eq('status', 'active'),
    supabase
      .from('alerts')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', id)
      .eq('is_read', false),
  ]);

  const salesByRecipe = new Map<string, number>();
  for (const row of salesRowsCurrent ?? []) {
    const recipeId = String(row.recipe_id);
    const qty = Number(row.quantity_sold ?? 0) || 0;
    salesByRecipe.set(recipeId, (salesByRecipe.get(recipeId) ?? 0) + qty);
  }

  const idealUsageByIngredient = new Map<
    string,
    { ingredient: string; unit: string; costPerUnit: number; quantity: number }
  >();
  for (const row of recipeItemsRows ?? []) {
    const recipeId = String(row.recipe_id);
    const soldQty = salesByRecipe.get(recipeId) ?? 0;
    if (soldQty <= 0) continue;
    const ingredientId = String(row.ingredient_id);
    const ingredient = normalizeIngredient(row.ingredients ?? null);
    const existing = idealUsageByIngredient.get(ingredientId);
    const usage = soldQty * (Number(row.quantity_grams ?? 0) || 0);
    idealUsageByIngredient.set(ingredientId, {
      ingredient: existing?.ingredient ?? String(ingredient?.name ?? 'Uncategorized'),
      unit: existing?.unit ?? String(ingredient?.unit ?? 'unit'),
      costPerUnit: existing?.costPerUnit ?? (Number(ingredient?.cost_per_unit ?? 0) || 0),
      quantity: (existing?.quantity ?? 0) + usage,
    });
  }

  const actualUsageByIngredient = new Map<
    string,
    { ingredient: string; unit: string; costPerUnit: number; quantity: number }
  >();
  for (const row of distributionRowsCurrent ?? []) {
    const ingredientId = String(row.ingredient_id);
    const ingredient = normalizeIngredient(row.ingredients ?? null);
    const existing = actualUsageByIngredient.get(ingredientId);
    actualUsageByIngredient.set(ingredientId, {
      ingredient: existing?.ingredient ?? String(ingredient?.name ?? 'Uncategorized'),
      unit: existing?.unit ?? String(ingredient?.unit ?? 'unit'),
      costPerUnit: existing?.costPerUnit ?? (Number(ingredient?.cost_per_unit ?? 0) || 0),
      quantity: (existing?.quantity ?? 0) + (Number(row.quantity ?? 0) || 0),
    });
  }

  const matrixRows = Array.from(
    new Set([...idealUsageByIngredient.keys(), ...actualUsageByIngredient.keys()]),
  )
    .map((ingredientId) => {
      const ideal = idealUsageByIngredient.get(ingredientId);
      const actual = actualUsageByIngredient.get(ingredientId);
      const idealUsage = Number(ideal?.quantity ?? 0);
      const actualUsage = Number(actual?.quantity ?? 0);
      const varianceAmount = actualUsage - idealUsage;
      const variancePercent = percentage(varianceAmount, idealUsage);
      const costPerUnit = Number(ideal?.costPerUnit ?? actual?.costPerUnit ?? 0);
      return {
        ingredient: String(ideal?.ingredient ?? actual?.ingredient ?? 'Uncategorized'),
        unit: String(ideal?.unit ?? actual?.unit ?? 'unit'),
        idealUsage,
        actualUsage,
        costPerUnit,
        varianceAmount,
        variancePercent,
        monetaryVariance: varianceAmount * costPerUnit,
      };
    })
    .sort((a, b) => Math.abs(b.monetaryVariance) - Math.abs(a.monetaryVariance));

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

  const grossSales = (salesRowsCurrent ?? []).reduce(
    (sum, row) => sum + (Number(row.total_revenue ?? 0) || 0),
    0,
  );
  const cogs = matrixRows.reduce((sum, row) => sum + row.idealUsage * row.costPerUnit, 0);
  const distributionCost = matrixRows.reduce(
    (sum, row) => sum + row.actualUsage * row.costPerUnit,
    0,
  );
  const wastePressure = Math.max(0, distributionCost - cogs);
  const laborCost = grossSales * 0.24;
  const opEx = grossSales * 0.15 + wastePressure * 0.35;
  const netProfit = grossSales - cogs - laborCost - opEx;
  const netMargin = percentage(netProfit, grossSales);

  const warehouseInvoiceTotal = (warehouseInvoiceRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount ?? 0) || 0),
    0,
  );
  const accountantInvoiceTotal = (accountantInvoiceRows ?? []).reduce(
    (sum, row) => sum + (Number(row.amount ?? 0) || 0),
    0,
  );
  const payrollTotal = (payrollRows ?? []).reduce(
    (sum, row) => sum + (Number(row.base_salary ?? 0) || 0),
    0,
  );
  const openAlertsCount = Number(openAlertsCountRaw ?? 0);

  const primaryLoss = fallbackLossSources[0];
  const insights = await generateFinancialCommentary({
    focus: 'variance',
    period: selectedPeriod,
    branchName: String(branch.name ?? ''),
    context: {
      grossSales,
      netProfit,
      netMarginPct: netMargin,
      cogs,
      foodCostPct: percentage(cogs, grossSales),
      laborCostPct: percentage(laborCost, grossSales),
      highRiskVarianceItems: matrixRows.filter((row) => Math.abs(row.variancePercent) > 5).length,
      topLossName: primaryLoss?.ingredient ?? 'No dominant ingredient',
      topLossValue: primaryLoss?.monetaryVariance ?? 0,
      warehouseInvoiceTotal,
      accountantInvoiceTotal,
      payrollTotal,
      openAlertsCount,
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
        financialsHref={`/branch/${id}/financials?period=${selectedPeriod}`}
        topLossSources={fallbackLossSources}
        matrixRows={matrixRows}
        insights={insights}
      />
    </div>
  );
}
