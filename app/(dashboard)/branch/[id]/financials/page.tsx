import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import { BranchFinancialIntelligence } from '@/components/finance/BranchFinancialIntelligence';

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

  const { data: supplierRows } = await supabase
    .from('suppliers')
    .select('id, name')
    .order('created_at', { ascending: false })
    .limit(100);

  const { data: invoiceRowsCurrent } = await supabase
    .from('warehouse_invoices')
    .select('id, total_amount')
    .eq('branch_id', id)
    .gte('billing_period_start', selectedStart)
    .lte('billing_period_start', selectedEnd);

  const { data: invoiceRowsPrevious } = await supabase
    .from('warehouse_invoices')
    .select('total_amount')
    .eq('branch_id', id)
    .gte('billing_period_start', previousStart)
    .lte('billing_period_start', previousEnd);

  const { data: vendorInvoiceRowsCurrent } = await supabase
    .from('tarek_invoices')
    .select('vendor_name, amount, created_at')
    .gte('created_at', `${selectedStart}T00:00:00`)
    .lte('created_at', `${selectedEnd}T23:59:59`);

  const { data: vendorInvoiceRowsPrevious } = await supabase
    .from('tarek_invoices')
    .select('vendor_name, amount, created_at')
    .gte('created_at', `${previousStart}T00:00:00`)
    .lte('created_at', `${previousEnd}T23:59:59`);

  const warehouseCurrent = (invoiceRowsCurrent ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount) || 0),
    0,
  );
  const warehousePrevious = (invoiceRowsPrevious ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount) || 0),
    0,
  );

  const invoiceIds = (invoiceRowsCurrent ?? []).map((row) => String(row.id));
  const { data: itemRowsCurrent } =
    invoiceIds.length > 0
      ? await supabase
          .from('warehouse_invoice_items')
          .select('amount, ingredients(name)')
          .in('invoice_id', invoiceIds)
      : { data: [] };

  const { data: distributionRowsCurrent } = await supabase
    .from('warehouse_distributions')
    .select('quantity, ingredients(cost_per_unit)')
    .eq('branch_id', id)
    .gte('distributed_at', selectedStart)
    .lte('distributed_at', selectedEnd);

  const { data: distributionRowsPrevious } = await supabase
    .from('warehouse_distributions')
    .select('quantity, ingredients(cost_per_unit)')
    .eq('branch_id', id)
    .gte('distributed_at', previousStart)
    .lte('distributed_at', previousEnd);

  const bucketTotals = new Map<string, number>();
  for (const row of itemRowsCurrent ?? []) {
    const ingredient = Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients;
    const label = String(ingredient?.name ?? 'Uncategorized');
    bucketTotals.set(
      label,
      (bucketTotals.get(label) ?? 0) + (Number(row.amount) || 0),
    );
  }

  const topSpendTiles = Array.from(bucketTotals.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 6)
    .map(([label, amount], index) => ({
      id: `${label}-${index}`,
      label,
      amount,
    }));

  const vendorTotalsCurrent = new Map<string, number>();
  for (const row of vendorInvoiceRowsCurrent ?? []) {
    const name = String(row.vendor_name ?? '').trim();
    if (!name) continue;
    const normalized = name.toLowerCase();
    if (
      normalized === 'ahmed' ||
      normalized === 'أحمد' ||
      normalized === 'احمد'
    ) {
      continue;
    }
    vendorTotalsCurrent.set(
      name,
      (vendorTotalsCurrent.get(name) ?? 0) + (Number(row.amount) || 0),
    );
  }

  const vendorCostRows = Array.from(vendorTotalsCurrent.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([name, total], idx) => ({
      id: `${name}-${idx}`,
      name,
      total,
    }));

  const invoiceVendors = vendorCostRows.map((row) => row.name);

  const foodSupplyCurrent = (distributionRowsCurrent ?? []).reduce((sum, row) => {
    const ingredient = Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients;
    const qty = Number(row.quantity ?? 0) || 0;
    const cost = Number(ingredient?.cost_per_unit ?? 0) || 0;
    return sum + qty * cost;
  }, 0);
  const foodSupplyPrevious = (distributionRowsPrevious ?? []).reduce((sum, row) => {
    const ingredient = Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients;
    const qty = Number(row.quantity ?? 0) || 0;
    const cost = Number(ingredient?.cost_per_unit ?? 0) || 0;
    return sum + qty * cost;
  }, 0);

  const operationalFees = Math.max(0, warehouseCurrent - foodSupplyCurrent);
  const deliveryFee = warehouseCurrent * 0.013;
  const tax = warehouseCurrent * 0.03;
  const serviceFees = warehouseCurrent * 0.031;
  const marketing = warehouseCurrent * 0.008;
  const necessaryCosts = warehouseCurrent * 0.02;
  const vendorInvoiceTotal = vendorCostRows.reduce(
    (sum, row) => sum + row.total,
    0,
  );
  const netTotal =
    foodSupplyCurrent +
    operationalFees +
    vendorInvoiceTotal +
    marketing +
    deliveryFee +
    tax +
    serviceFees +
    necessaryCosts;
  const netProfit = Math.max(0, netTotal * 0.18);
  const marginPct =
    netTotal > 0 ? (netProfit / netTotal) * 100 : 0;

  const warehouseDelta = warehouseCurrent - warehousePrevious;
  const foodDelta = foodSupplyCurrent - foodSupplyPrevious;
  const vendorPreviousTotal = (vendorInvoiceRowsPrevious ?? []).reduce(
    (sum, row) => {
      const name = String(row.vendor_name ?? '').trim().toLowerCase();
      if (name === 'ahmed' || name === 'أحمد' || name === 'احمد') {
        return sum;
      }
      return sum + (Number(row.amount) || 0);
    },
    0,
  );
  const vendorDelta = vendorInvoiceTotal - vendorPreviousTotal;

  const insights = [
    {
      id: 'warehouse',
      text:
        warehouseDelta >= 0
          ? `Operational spending increased by $${warehouseDelta.toFixed(2)} versus last month.`
          : `Operational spending improved by $${Math.abs(warehouseDelta).toFixed(2)} versus last month.`,
    },
    {
      id: 'food',
      text:
        foodDelta >= 0
          ? `Food supply costs increased by $${foodDelta.toFixed(2)} versus last month.`
          : `Food supply costs improved by $${Math.abs(foodDelta).toFixed(2)} versus last month.`,
    },
    {
      id: 'fees',
      text: `Current operations mix: food ${warehouseCurrent > 0 ? ((foodSupplyCurrent / warehouseCurrent) * 100).toFixed(1) : '0.0'}% and fees ${warehouseCurrent > 0 ? ((operationalFees / warehouseCurrent) * 100).toFixed(1) : '0.0'}%.`,
    },
    {
      id: 'necessary',
      text: `A required operations reserve of $${necessaryCosts.toFixed(2)} is included for hidden running costs.`,
    },
    {
      id: 'vendors',
      text:
        vendorDelta >= 0
          ? `Vendor invoice costs increased by $${vendorDelta.toFixed(2)} versus last month.`
          : `Vendor invoice costs improved by $${Math.abs(vendorDelta).toFixed(2)} versus last month.`,
    },
  ];

  const monthLabel = new Date(
    `${selectedPeriod}-01T12:00:00`,
  ).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  });

  return (
    <div className="w-full" dir="ltr">
      <BranchFinancialIntelligence
        branchId={id}
        branchName={String(branch.name ?? '').toUpperCase()}
        monthLabel={monthLabel}
        selectedPeriod={selectedPeriod}
        monthHrefPrev={`/branch/${id}/financials?period=${addMonths(selectedPeriod, -1)}`}
        monthHrefNext={`/branch/${id}/financials?period=${addMonths(selectedPeriod, 1)}`}
        varianceHref={`/branch/${id}/financials/variance?period=${selectedPeriod}`}
        insights={insights}
        metricCards={[
          { label: 'Net Total', value: netTotal },
          { label: 'Food Supplies', value: foodSupplyCurrent },
          { label: 'Operational Fees', value: operationalFees },
          { label: 'Vendor Invoices', value: vendorInvoiceTotal },
          { label: 'Marketing', value: marketing },
          { label: 'Delivery Fee', value: deliveryFee },
          { label: 'Tax', value: tax },
          { label: 'Service Fees', value: serviceFees },
          { label: 'Necessary Costs', value: necessaryCosts },
        ]}
        topSpendTiles={
          topSpendTiles.length > 0
            ? topSpendTiles
            : [
                {
                  id: 'empty-1',
                  label: 'No invoice items for this period',
                  amount: 0,
                },
              ]
        }
        invoiceVendors={invoiceVendors}
        vendorCostRows={vendorCostRows}
        suppliers={(supplierRows ?? []).map((row) => ({
          id: String(row.id),
          name: String(row.name ?? ''),
        }))}
        netProfit={netProfit}
        marginPct={marginPct}
      />
    </div>
  );
}
