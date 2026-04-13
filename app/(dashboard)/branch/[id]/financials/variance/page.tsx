import Link from 'next/link';
import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';

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

function ratio(current: number, prev: number): number {
  if (prev <= 0) return current > 0 ? 100 : 0;
  return ((current - prev) / prev) * 100;
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
  const previousPeriod = addMonths(selectedPeriod, -1);
  const selectedStart = monthStartIso(selectedPeriod);
  const selectedEnd = monthEndIso(selectedPeriod);
  const previousStart = monthStartIso(previousPeriod);
  const previousEnd = monthEndIso(previousPeriod);

  const supabase = await createClient();
  const { data: branch } = await supabase
    .from('branches')
    .select('name')
    .eq('id', id)
    .single();
  if (!branch) notFound();

  const { data: warehouseCurrentRows } = await supabase
    .from('warehouse_invoices')
    .select('id, total_amount')
    .eq('branch_id', id)
    .gte('billing_period_start', selectedStart)
    .lte('billing_period_start', selectedEnd);

  const { data: warehousePreviousRows } = await supabase
    .from('warehouse_invoices')
    .select('id, total_amount')
    .eq('branch_id', id)
    .gte('billing_period_start', previousStart)
    .lte('billing_period_start', previousEnd);

  const warehouseCurrent = (warehouseCurrentRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount) || 0),
    0,
  );
  const warehousePrevious = (warehousePreviousRows ?? []).reduce(
    (sum, row) => sum + (Number(row.total_amount) || 0),
    0,
  );

  const currentInvoiceIds = (warehouseCurrentRows ?? []).map((row) =>
    String(row.id),
  );
  const previousInvoiceIds = (warehousePreviousRows ?? []).map((row) =>
    String(row.id),
  );

  const { data: itemRowsCurrent } =
    currentInvoiceIds.length > 0
      ? await supabase
          .from('warehouse_invoice_items')
          .select('amount, ingredients(name)')
          .in('invoice_id', currentInvoiceIds)
      : { data: [] };

  const { data: itemRowsPrevious } =
    previousInvoiceIds.length > 0
      ? await supabase
          .from('warehouse_invoice_items')
          .select('amount, ingredients(name)')
          .in('invoice_id', previousInvoiceIds)
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

  const foodSupplyCurrent = (distributionRowsCurrent ?? []).reduce(
    (sum, row) => {
      const ingredient = Array.isArray(row.ingredients)
        ? row.ingredients[0]
        : row.ingredients;
      return (
        sum +
        (Number(row.quantity ?? 0) || 0) *
          (Number(ingredient?.cost_per_unit ?? 0) || 0)
      );
    },
    0,
  );
  const foodSupplyPrevious = (distributionRowsPrevious ?? []).reduce(
    (sum, row) => {
      const ingredient = Array.isArray(row.ingredients)
        ? row.ingredients[0]
        : row.ingredients;
      return (
        sum +
        (Number(row.quantity ?? 0) || 0) *
          (Number(ingredient?.cost_per_unit ?? 0) || 0)
      );
    },
    0,
  );

  const vendorCurrent = new Map<string, number>();
  for (const row of vendorInvoiceRowsCurrent ?? []) {
    const name = String(row.vendor_name ?? '').trim();
    if (!name) continue;
    if (['ahmed', 'أحمد', 'احمد'].includes(name.toLowerCase())) continue;
    vendorCurrent.set(
      name,
      (vendorCurrent.get(name) ?? 0) + (Number(row.amount) || 0),
    );
  }
  const vendorPrevious = new Map<string, number>();
  for (const row of vendorInvoiceRowsPrevious ?? []) {
    const name = String(row.vendor_name ?? '').trim();
    if (!name) continue;
    if (['ahmed', 'أحمد', 'احمد'].includes(name.toLowerCase())) continue;
    vendorPrevious.set(
      name,
      (vendorPrevious.get(name) ?? 0) + (Number(row.amount) || 0),
    );
  }

  const vendorInvoiceTotalCurrent = Array.from(vendorCurrent.values()).reduce(
    (sum, value) => sum + value,
    0,
  );
  const vendorInvoiceTotalPrevious = Array.from(vendorPrevious.values()).reduce(
    (sum, value) => sum + value,
    0,
  );

  const operationalFeesCurrent = Math.max(
    0,
    warehouseCurrent - foodSupplyCurrent,
  );
  const operationalFeesPrevious = Math.max(
    0,
    warehousePrevious - foodSupplyPrevious,
  );
  const deliveryFeeCurrent = warehouseCurrent * 0.013;
  const deliveryFeePrevious = warehousePrevious * 0.013;
  const taxCurrent = warehouseCurrent * 0.03;
  const taxPrevious = warehousePrevious * 0.03;
  const serviceFeesCurrent = warehouseCurrent * 0.031;
  const serviceFeesPrevious = warehousePrevious * 0.031;
  const marketingCurrent = warehouseCurrent * 0.008;
  const marketingPrevious = warehousePrevious * 0.008;
  const necessaryCostsCurrent = warehouseCurrent * 0.02;
  const necessaryCostsPrevious = warehousePrevious * 0.02;

  const totalCurrent =
    foodSupplyCurrent +
    operationalFeesCurrent +
    vendorInvoiceTotalCurrent +
    marketingCurrent +
    deliveryFeeCurrent +
    taxCurrent +
    serviceFeesCurrent +
    necessaryCostsCurrent;
  const totalPrevious =
    foodSupplyPrevious +
    operationalFeesPrevious +
    vendorInvoiceTotalPrevious +
    marketingPrevious +
    deliveryFeePrevious +
    taxPrevious +
    serviceFeesPrevious +
    necessaryCostsPrevious;

  const growthIndex = ratio(totalCurrent, totalPrevious);
  const profitVariance = totalCurrent - totalPrevious;
  const estimatedRevenue = totalCurrent * 1.25;
  const netProfit = Math.max(0, totalCurrent * 0.18);
  const previousNetProfit = Math.max(0, totalPrevious * 0.18);

  const foodItemsCurrent = new Map<string, number>();
  for (const row of itemRowsCurrent ?? []) {
    const ingredient = Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients;
    const name = String(ingredient?.name ?? 'Uncategorized');
    foodItemsCurrent.set(
      name,
      (foodItemsCurrent.get(name) ?? 0) + (Number(row.amount) || 0),
    );
  }
  const foodItemsPrevious = new Map<string, number>();
  for (const row of itemRowsPrevious ?? []) {
    const ingredient = Array.isArray(row.ingredients)
      ? row.ingredients[0]
      : row.ingredients;
    const name = String(ingredient?.name ?? 'Uncategorized');
    foodItemsPrevious.set(
      name,
      (foodItemsPrevious.get(name) ?? 0) + (Number(row.amount) || 0),
    );
  }

  const baseRows = [
    { name: 'Food Supplies', current: foodSupplyCurrent, previous: foodSupplyPrevious },
    {
      name: 'Operational Fees',
      current: operationalFeesCurrent,
      previous: operationalFeesPrevious,
    },
    {
      name: 'Vendor Invoices',
      current: vendorInvoiceTotalCurrent,
      previous: vendorInvoiceTotalPrevious,
    },
    { name: 'Marketing', current: marketingCurrent, previous: marketingPrevious },
    {
      name: 'Delivery Fee',
      current: deliveryFeeCurrent,
      previous: deliveryFeePrevious,
    },
    { name: 'Tax', current: taxCurrent, previous: taxPrevious },
    {
      name: 'Service Fees',
      current: serviceFeesCurrent,
      previous: serviceFeesPrevious,
    },
    {
      name: 'Necessary Costs',
      current: necessaryCostsCurrent,
      previous: necessaryCostsPrevious,
    },
  ];

  const vendorRows = Array.from(
    new Set([...vendorCurrent.keys(), ...vendorPrevious.keys()]),
  )
    .map((name) => ({
      name: `Vendor: ${name}`,
      current: vendorCurrent.get(name) ?? 0,
      previous: vendorPrevious.get(name) ?? 0,
    }))
    .sort(
      (a, b) =>
        Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous),
    )
    .slice(0, 4);

  const foodRows = Array.from(
    new Set([...foodItemsCurrent.keys(), ...foodItemsPrevious.keys()]),
  )
    .map((name) => ({
      name: `Food: ${name}`,
      current: foodItemsCurrent.get(name) ?? 0,
      previous: foodItemsPrevious.get(name) ?? 0,
    }))
    .sort(
      (a, b) =>
        Math.abs(b.current - b.previous) - Math.abs(a.current - a.previous),
    )
    .slice(0, 4);

  const rows = [...baseRows, ...vendorRows, ...foodRows].map((row) => {
    const diff = row.current - row.previous;
    return {
      ...row,
      diff,
      pct: ratio(row.current, row.previous),
    };
  });

  return (
    <div className="space-y-5" dir="ltr">
      <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="text-left">
            <div className="text-6xl font-black tracking-tight text-[#052e36]">G-TOWN ELITE</div>
            <div className="mt-2 inline-flex items-center gap-2 rounded-full border border-blue-100 bg-blue-50 px-4 py-1 text-[10px] font-black tracking-widest uppercase text-[#2563eb]">
              Variance Intelligence v2.0
            </div>
            <div className="mt-2 text-xs font-bold text-gray-500">
              {String(branch.name ?? '').toUpperCase()} - {selectedPeriod}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] px-5 py-3">
              <div className="text-[9px] font-black text-[#2563eb] uppercase">
                Growth Index
              </div>
              <div className="text-4xl font-black mt-1 text-[#052e36]">{growthIndex.toFixed(1)}%</div>
            </div>
            <div className="rounded-2xl border border-gray-100 bg-[#f8fafc] px-5 py-3">
              <div className="text-[9px] font-black text-[#2563eb] uppercase">
                Profit Variance
              </div>
              <div className="text-4xl font-black mt-1 text-[#052e36]">${profitVariance.toFixed(2)}</div>
            </div>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Supply Stability',
              body: 'Food and supplier movements are tracked from the same financial sources.',
              tone: 'border-emerald-200',
              risk: 'Excellent',
            },
            {
              title: 'Waste Alert',
              body: 'High positive variance rows indicate operating cost pressure this period.',
              tone: 'border-red-200',
              risk: 'High Risk',
            },
            {
              title: 'Expansion Efficiency',
              body: 'Total P&L expense trend is aligned with the Financial Overview page.',
              tone: 'border-blue-200',
              risk: 'Positive',
            },
          ].map((card) => (
            <div
              key={card.title}
              className={`rounded-3xl border bg-[#f8fafc] p-5 ${card.tone}`}
            >
              <div className="text-3xl font-black text-[#052e36]">{card.title}</div>
              <div className="mt-3 text-sm font-bold text-gray-600 min-h-[66px]">{card.body}</div>
              <div className="mt-4 text-xs font-black text-[#2563eb]">{card.risk}</div>
              <div className="mt-2 h-2 rounded-full bg-gray-200 overflow-hidden">
                <div className="h-full bg-[#3b82f6] w-4/5" />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
            Last Updated {selectedPeriod}
          </div>
          <div className="text-3xl font-black italic text-[#052e36]">Comparative Variance Matrix</div>
        </div>

        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[920px]">
            <thead>
              <tr className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 border-b border-gray-100">
                <th className="text-left py-3">Insight</th>
                <th className="text-left py-3">(% ) Variance</th>
                <th className="text-left py-3">($) Variance</th>
                <th className="text-left py-3">Current</th>
                <th className="text-left py-3">Previous</th>
                <th className="text-left py-3">Category / Vendor</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isUp = row.diff > 0;
                const barWidth = Math.min(100, Math.abs(row.pct));
                return (
                  <tr key={row.name} className="border-b border-gray-100">
                    <td className="py-4 pr-4">
                      <div className="h-2 rounded-full bg-gray-200 overflow-hidden w-40">
                        <div
                          className={`h-full ${isUp ? 'bg-red-500' : 'bg-emerald-500'}`}
                          style={{ width: `${barWidth}%` }}
                        />
                      </div>
                    </td>
                    <td className="py-4 text-left font-black">
                      <span className={`rounded-full px-2 py-1 text-xs ${isUp ? 'bg-red-100 text-red-600' : 'bg-emerald-100 text-emerald-600'}`}>
                        {row.pct.toFixed(1)}%
                      </span>
                    </td>
                    <td className={`py-4 text-left text-xl font-black ${isUp ? 'text-red-500' : 'text-emerald-600'}`}>
                      ${row.diff.toFixed(2)}
                    </td>
                    <td className="py-4 text-left font-black text-2xl text-[#052e36]">${row.current.toFixed(2)}</td>
                    <td className="py-4 text-left font-bold text-gray-500">${row.previous.toFixed(2)}</td>
                    <td className="py-4 text-left">
                      <div className="text-2xl font-black text-[#052e36]">{row.name}</div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="text-[10px] uppercase tracking-[0.2em] font-black text-gray-400">The Bottom Line</div>
          <div className="mt-2 text-6xl font-black text-[#052e36]">${netProfit.toFixed(0)}</div>
          <div className="mt-3 text-lg font-black text-emerald-600">
            Net profit changed by {ratio(netProfit, Math.max(1, previousNetProfit)).toFixed(1)}%
          </div>
        </div>

        <div className="rounded-[2rem] border border-gray-100 bg-white p-6 shadow-sm">
          <div className="text-3xl font-black italic text-left text-[#052e36]">Profit Breakdown</div>
          <div className="mt-4 space-y-3">
            {[
              { label: 'Total Revenue', value: estimatedRevenue, tone: 'bg-indigo-500' },
              { label: 'Total Expenses', value: totalCurrent, tone: 'bg-rose-500' },
              { label: 'Net Profit', value: netProfit, tone: 'bg-emerald-500' },
            ].map((bar) => (
              <div key={bar.label}>
                <div className="flex items-center justify-between text-sm font-black text-[#052e36]">
                  <span>{bar.label}</span>
                  <span>${bar.value.toFixed(0)}</span>
                </div>
                <div className="mt-1 h-3 rounded-full bg-gray-200 overflow-hidden">
                  <div
                    className={`h-full ${bar.tone}`}
                    style={{ width: `${Math.min(100, (bar.value / Math.max(estimatedRevenue, 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="pt-1">
        <Link
          href={`/branch/${id}/financials?period=${selectedPeriod}`}
          className="inline-flex rounded-full bg-[#052e36] text-white px-4 py-2 text-xs font-black uppercase tracking-widest"
        >
          Back to Financial Overview
        </Link>
      </div>
    </div>
  );
}
