'use client';

import { useMemo, useState } from 'react';
import { useFinancialsDashboard } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';
import { formatFinancialCurrency, formatFinancialPct } from '@/components/finance/financials-dashboard/financials-format';

export function DecisionSimulatorSection() {
  const { grossSales, netTotal, totalDeductions, operatingExpenses, pnl } = useFinancialsDashboard();
  const [priceIncreasePct, setPriceIncreasePct] = useState(0);
  const [expenseReductionPct, setExpenseReductionPct] = useState(0);

  const baselineRevenue = useMemo(
    () => Math.max(grossSales, netTotal, Math.abs(pnl), 10000),
    [grossSales, netTotal, pnl],
  );
  const baselineOpex = useMemo(
    () => Math.max(operatingExpenses, totalDeductions, Math.abs(pnl) * 0.25, 5000),
    [operatingExpenses, totalDeductions, pnl],
  );

  const projectedRevenue = useMemo(
    () => baselineRevenue * (1 + priceIncreasePct / 100),
    [baselineRevenue, priceIncreasePct],
  );
  const projectedOpex = useMemo(
    () => baselineOpex * (1 - expenseReductionPct / 100),
    [baselineOpex, expenseReductionPct],
  );

  const projectedProfit = useMemo(
    () => projectedRevenue - projectedOpex - totalDeductions,
    [projectedRevenue, projectedOpex, totalDeductions],
  );
  const projectedDelta = projectedProfit - pnl;
  const projectedRoi = projectedRevenue > 0 ? (projectedProfit / projectedRevenue) * 100 : 0;

  return (
    <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs text-gray-500">Projected Financial Impact</p>
        <p className="mt-3 text-5xl font-black text-[#052e36]">{formatFinancialCurrency(projectedProfit)}</p>
        <p className="mt-2 text-sm text-gray-600">Projected ROI: {formatFinancialPct(projectedRoi)}</p>
        <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">Projected Revenue</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatFinancialCurrency(projectedRevenue)}</p>
          </div>
          <div className="rounded-xl bg-slate-50 p-3">
            <p className="text-[11px] text-slate-500">Projected Operating Cost</p>
            <p className="mt-1 text-lg font-bold text-slate-900">{formatFinancialCurrency(projectedOpex)}</p>
          </div>
        </div>
        <p
          className={`mt-4 text-sm font-semibold ${projectedDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}
        >
          Profit change vs current: {projectedDelta >= 0 ? '+' : ''}
          {formatFinancialCurrency(projectedDelta)}
        </p>
      </article>
      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <label className="mb-6 block">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-700">
            <span>Price Increase (%)</span>
            <span>{priceIncreasePct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={20}
            value={priceIncreasePct}
            onChange={(event) => setPriceIncreasePct(Number(event.target.value))}
            className="w-full accent-cyan-400"
          />
        </label>
        <label className="block">
          <div className="mb-2 flex items-center justify-between text-sm text-gray-700">
            <span>Opex Reduction (%)</span>
            <span>{expenseReductionPct}%</span>
          </div>
          <input
            type="range"
            min={0}
            max={25}
            value={expenseReductionPct}
            onChange={(event) => setExpenseReductionPct(Number(event.target.value))}
            className="w-full accent-rose-400"
          />
        </label>
        <p className="mt-4 text-xs text-slate-500">
          Simulation scales revenue and operating costs from current P&amp;L drivers; deductions are held flat.
        </p>
      </article>
    </section>
  );
}
