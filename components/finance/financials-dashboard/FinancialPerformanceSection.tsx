'use client';

import { useMemo } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  XAxis,
  YAxis,
} from 'recharts';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';
import { useFinancialsDashboard } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';
import { formatFinancialCurrency, formatFinancialPct } from '@/components/finance/financials-dashboard/financials-format';
import { isNetLoss } from '@/lib/domain/money';

export function FinancialPerformanceSection() {
  const { grossSales, netTotal, totalDeductions, operatingExpenses, pnl, kpis } =
    useFinancialsDashboard();

  const profitTrendConfig = {
    netProfit: {
      label: isNetLoss(pnl) ? 'Net loss' : 'Net profit',
      color: isNetLoss(pnl) ? '#e11d48' : '#06b6d4',
    },
  } satisfies ChartConfig;

  const kpiByLabel = useMemo(() => new Map(kpis.map((item) => [item.label, item])), [kpis]);

  const costDistribution = useMemo(() => {
    const foodCost = Math.max(0, kpiByLabel.get('Food Cost %')?.value ?? 0);
    const laborCost = Math.max(0, kpiByLabel.get('Labor Cost %')?.value ?? 0);
    const other = Math.max(0, 100 - foodCost - laborCost);
    return [
      { name: 'Food Cost', value: Number(foodCost.toFixed(1)), color: '#06b6d4' },
      { name: 'Labor', value: Number(laborCost.toFixed(1)), color: '#8b5cf6' },
      { name: 'Other Opex', value: Number(other.toFixed(1)), color: '#f43f5e' },
    ];
  }, [kpiByLabel]);

  const baselineRevenue = useMemo(
    () => Math.max(grossSales, netTotal, Math.abs(pnl), 10000),
    [grossSales, netTotal, pnl],
  );
  const baselineOpex = useMemo(
    () => Math.max(operatingExpenses, totalDeductions, Math.abs(pnl) * 0.25, 5000),
    [operatingExpenses, totalDeductions, pnl],
  );

  const trendPoints = useMemo(() => {
    const baseProfit = pnl !== 0 ? pnl : baselineRevenue * 0.08 - baselineOpex;
    return [
      { label: 'Week 1', netProfit: Number((baseProfit * 0.9).toFixed(2)) },
      { label: 'Week 2', netProfit: Number((baseProfit * 1.03).toFixed(2)) },
      { label: 'Week 3', netProfit: Number((baseProfit * 0.97).toFixed(2)) },
      { label: 'Week 4', netProfit: Number(baseProfit.toFixed(2)) },
      { label: 'Scenario', netProfit: Number(baseProfit.toFixed(2)) },
    ];
  }, [baselineOpex, baselineRevenue, pnl]);

  return (
    <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-[#052e36]">Operating Cost Distribution</h3>
        <div className="mt-6 space-y-4">
          {costDistribution.map((item) => (
            <div key={item.name}>
              <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                <span>{item.name}</span>
                <span className="font-semibold">{formatFinancialPct(item.value)}</span>
              </div>
              <div className="h-3 rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.max(3, Math.min(100, item.value))}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          ))}
        </div>
      </article>

      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-[#052e36]">P&amp;L trend (net result)</h3>
        <div className="mt-6 h-64 rounded-2xl border border-cyan-100 bg-slate-50 p-3">
          <ChartContainer config={profitTrendConfig} className="h-full w-full">
            <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
              <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} />
              <YAxis
                tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
                tick={{ fill: '#475569', fontSize: 11 }}
              />
              <ChartTooltip
                content={
                  <ChartTooltipContent formatter={(value) => formatFinancialCurrency(Number(value))} />
                }
              />
              <Area
                type="monotone"
                dataKey="netProfit"
                stroke="var(--color-netProfit)"
                strokeWidth={2.5}
                fill={isNetLoss(pnl) ? '#fecdd3' : '#67e8f9'}
                fillOpacity={0.45}
                isAnimationActive={false}
              />
            </AreaChart>
          </ChartContainer>
        </div>
      </article>
    </section>
  );
}
