import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { ExecutiveFinancialDashboard } from '@/components/finance/ExecutiveFinancialDashboard';
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
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function normalizeIngredient(
  ingredient: { name?: string | null; cost_per_unit?: number | null } | Array<{ name?: string | null; cost_per_unit?: number | null }> | null,
) {
  if (!ingredient) return null;
  return Array.isArray(ingredient) ? ingredient[0] : ingredient;
}

export default async function BranchFinancialsPage({
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
  const previousPeriod = addMonths(selectedPeriod, -1);
  const previousStart = monthStartIso(previousPeriod);
  const previousEnd = monthEndIso(previousPeriod);

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

  const { data: salesRowsPrevious } = await supabase
    .from('sales')
    .select('recipe_id, quantity_sold, total_revenue')
    .eq('branch_id', id)
    .gte('sale_date', previousStart)
    .lte('sale_date', previousEnd);

  const { data: distributionRowsCurrent } = await supabase
    .from('warehouse_distributions')
    .select('ingredient_id, quantity, ingredients(name, cost_per_unit)')
    .eq('branch_id', id)
    .gte('distributed_at', selectedStart)
    .lte('distributed_at', selectedEnd);

  const { data: distributionRowsPrevious } = await supabase
    .from('warehouse_distributions')
    .select('ingredient_id, quantity, ingredients(name, cost_per_unit)')
    .eq('branch_id', id)
    .gte('distributed_at', previousStart)
    .lte('distributed_at', previousEnd);

  const [
    { data: warehouseInvoiceRows },
    { data: accountantInvoiceRows },
    { data: payrollRows },
    { count: openAlertsCountRaw },
    { data: qualityRows },
    { count: checklistCountRaw },
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
    supabase
      .from('quality_feedback')
      .select('food_score, service_score, cleanliness_score')
      .eq('branch_id', id)
      .gte('submitted_at', `${selectedStart}T00:00:00`)
      .lte('submitted_at', `${selectedEnd}T23:59:59`),
    supabase
      .from('checklists')
      .select('id', { count: 'exact', head: true })
      .eq('branch_id', id)
      .gte('submitted_at', `${selectedStart}T00:00:00`)
      .lte('submitted_at', `${selectedEnd}T23:59:59`),
  ]);

  const allRecipeIds = Array.from(
    new Set([
      ...(salesRowsCurrent ?? []).map((row) => String(row.recipe_id)),
      ...(salesRowsPrevious ?? []).map((row) => String(row.recipe_id)),
    ]),
  );

  const { data: recipeItemsRows } =
    allRecipeIds.length > 0
      ? await supabase
          .from('recipe_items')
          .select('recipe_id, quantity_grams, ingredients(cost_per_unit)')
          .in('recipe_id', allRecipeIds)
      : { data: [] };

  const recipeCost = new Map<string, number>();
  for (const row of recipeItemsRows ?? []) {
    const ingredient = normalizeIngredient(row.ingredients ?? null);
    const ingredientCost = Number(ingredient?.cost_per_unit ?? 0) || 0;
    const recipeId = String(row.recipe_id);
    const quantity = Number(row.quantity_grams ?? 0) || 0;
    recipeCost.set(recipeId, (recipeCost.get(recipeId) ?? 0) + quantity * ingredientCost);
  }

  const grossSales = (salesRowsCurrent ?? []).reduce(
    (sum, row) => sum + (Number(row.total_revenue ?? 0) || 0),
    0,
  );
  const previousGrossSales = (salesRowsPrevious ?? []).reduce(
    (sum, row) => sum + (Number(row.total_revenue ?? 0) || 0),
    0,
  );

  const cogs = (salesRowsCurrent ?? []).reduce((sum, row) => {
    const rc = recipeCost.get(String(row.recipe_id)) ?? 0;
    const qty = Number(row.quantity_sold ?? 0) || 0;
    return sum + rc * qty;
  }, 0);
  const previousCogs = (salesRowsPrevious ?? []).reduce((sum, row) => {
    const rc = recipeCost.get(String(row.recipe_id)) ?? 0;
    const qty = Number(row.quantity_sold ?? 0) || 0;
    return sum + rc * qty;
  }, 0);

  const ingredientSpendCurrent = new Map<string, number>();
  const ingredientSpendPrevious = new Map<string, number>();
  const distributionCostCurrent = (distributionRowsCurrent ?? []).reduce((sum, row) => {
    const ingredient = normalizeIngredient(row.ingredients ?? null);
    const name = String(ingredient?.name ?? 'Uncategorized');
    const qty = Number(row.quantity ?? 0) || 0;
    const cost = Number(ingredient?.cost_per_unit ?? 0) || 0;
    const spend = qty * cost;
    ingredientSpendCurrent.set(name, (ingredientSpendCurrent.get(name) ?? 0) + spend);
    return sum + spend;
  }, 0);
  const distributionCostPrevious = (distributionRowsPrevious ?? []).reduce((sum, row) => {
    const ingredient = normalizeIngredient(row.ingredients ?? null);
    const name = String(ingredient?.name ?? 'Uncategorized');
    const qty = Number(row.quantity ?? 0) || 0;
    const cost = Number(ingredient?.cost_per_unit ?? 0) || 0;
    const spend = qty * cost;
    ingredientSpendPrevious.set(name, (ingredientSpendPrevious.get(name) ?? 0) + spend);
    return sum + spend;
  }, 0);

  const wastePressure = Math.max(0, distributionCostCurrent - cogs);
  const previousWastePressure = Math.max(0, distributionCostPrevious - previousCogs);
  const laborCost = grossSales * (0.22 + Math.min(0.08, percentage(wastePressure, grossSales) / 100));
  const previousLaborCost =
    previousGrossSales *
    (0.22 + Math.min(0.08, percentage(previousWastePressure, previousGrossSales) / 100));

  const opEx = grossSales * 0.15 + wastePressure * 0.35;
  const previousOpEx = previousGrossSales * 0.15 + previousWastePressure * 0.35;

  const netProfit = grossSales - cogs - laborCost - opEx;
  const previousNetProfit = previousGrossSales - previousCogs - previousLaborCost - previousOpEx;

  const netMargin = percentage(netProfit, grossSales);
  const previousNetMargin = percentage(previousNetProfit, previousGrossSales);
  const foodCostPct = percentage(cogs, grossSales);
  const previousFoodCostPct = percentage(previousCogs, previousGrossSales);
  const laborCostPct = percentage(laborCost, grossSales);
  const opExPct = percentage(opEx, grossSales);

  const topIngredientMove = Array.from(
    new Set([...ingredientSpendCurrent.keys(), ...ingredientSpendPrevious.keys()]),
  )
    .map((name) => ({
      name,
      delta: (ingredientSpendCurrent.get(name) ?? 0) - (ingredientSpendPrevious.get(name) ?? 0),
    }))
    .sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0] ?? {
    name: 'primary ingredients',
    delta: 0,
  };

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
  const checklistCount = Number(checklistCountRaw ?? 0);
  const qualityAverage =
    (qualityRows ?? []).length > 0
      ? (qualityRows ?? []).reduce((sum, row) => {
          const score = (Number(row.food_score ?? 0) + Number(row.service_score ?? 0) + Number(row.cleanliness_score ?? 0)) / 3;
          return sum + score;
        }, 0) / (qualityRows ?? []).length
      : 0;

  const insights = await generateFinancialCommentary({
    focus: 'financial',
    period: selectedPeriod,
    branchName: String(branch.name ?? ''),
    context: {
      grossSales,
      netProfit,
      netMarginPct: netMargin,
      cogs,
      foodCostPct,
      laborCost,
      laborCostPct,
      opEx,
      opExPct,
      previousGrossSales,
      previousNetProfit,
      previousNetMarginPct: previousNetMargin,
      previousFoodCostPct,
      distributionCostCurrent,
      wastePressure,
      topDriver: topIngredientMove.name,
      topDriverDelta: topIngredientMove.delta,
      warehouseInvoiceTotal,
      accountantInvoiceTotal,
      payrollTotal,
      openAlertsCount,
      checklistCount,
      qualityAverage,
    },
  });

  const monthLabel = new Date(
    `${selectedPeriod}-01T12:00:00`,
  ).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-full" dir="ltr">
      <ExecutiveFinancialDashboard
        branchName={String(branch.name ?? '').toUpperCase()}
        monthLabel={monthLabel}
        selectedPeriod={selectedPeriod}
        monthHrefPrev={`/branch/${id}/financials?period=${addMonths(selectedPeriod, -1)}`}
        monthHrefNext={`/branch/${id}/financials?period=${addMonths(selectedPeriod, 1)}`}
        varianceHref={`/branch/${id}/financials/variance?period=${selectedPeriod}`}
        insights={insights}
        grossSales={grossSales}
        cogs={cogs}
        laborCost={laborCost}
        opEx={opEx}
        netProfit={netProfit}
        kpis={[
          {
            label: 'Net Margin',
            value: netMargin,
            target: 18,
            description: 'Net profit as a share of gross sales.',
            tone: netMargin >= 18 ? 'good' : netMargin >= 12 ? 'warning' : 'danger',
          },
          {
            label: 'Food Cost %',
            value: foodCostPct,
            target: 30,
            description: 'Theoretical COGS from sales x recipe items.',
            tone: foodCostPct <= 30 ? 'good' : foodCostPct <= 35 ? 'warning' : 'danger',
          },
          {
            label: 'Labor Cost %',
            value: laborCostPct,
            target: 25,
            description: 'Labor load adjusted by inventory pressure.',
            tone: laborCostPct <= 25 ? 'good' : laborCostPct <= 30 ? 'warning' : 'danger',
          },
        ]}
      />
    </div>
  );
}
