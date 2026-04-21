'use client';

import { useMemo, useState } from 'react';
import { TrendingDown, TrendingUp } from 'lucide-react';
import { useFinancialsDashboard } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';
import { formatFinancialCurrency, formatFinancialCurrencyDetailed, formatFinancialPct } from '@/components/finance/financials-dashboard/financials-format';
import { isNetLoss, netProfitLossLabel } from '@/lib/domain/money';

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

  const currentIsLoss = isNetLoss(pnl);
  const projectedIsProfit = !isNetLoss(projectedProfit);

  const deltaLine = (() => {
    if (currentIsLoss && projectedDelta > 0) {
      return {
        label: 'Loss reduction vs current',
        sub: 'Improves your bottom line; you may still be in a net loss until revenue exceeds total costs.',
        amount: `+${formatFinancialCurrencyDetailed(projectedDelta)}`,
        tone: 'amber' as const,
        Icon: TrendingUp,
      };
    }
    if (currentIsLoss && projectedDelta <= 0) {
      return {
        label: 'Change vs current (loss position)',
        sub: null as string | null,
        amount: formatFinancialCurrencyDetailed(projectedDelta),
        tone: 'rose' as const,
        Icon: TrendingDown,
      };
    }
    if (!currentIsLoss && projectedDelta >= 0) {
      return {
        label: 'Profit improvement vs current',
        sub: null as string | null,
        amount: `+${formatFinancialCurrencyDetailed(projectedDelta)}`,
        tone: 'emerald' as const,
        Icon: TrendingUp,
      };
    }
    return {
      label: 'Profit decline vs current',
      sub: null as string | null,
      amount: formatFinancialCurrencyDetailed(projectedDelta),
      tone: 'rose' as const,
      Icon: TrendingDown,
    };
  })();

  const toneClasses =
    deltaLine.tone === 'emerald'
      ? 'text-emerald-700'
      : deltaLine.tone === 'amber'
        ? 'text-amber-800'
        : 'text-rose-700';

  const DeltaImpactIcon = deltaLine.Icon;

  return (
    <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs text-gray-500">Projected Financial Impact</p>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">
          {netProfitLossLabel(projectedProfit)}
        </p>
        <p
          className={`mt-2 text-5xl font-black ${
            projectedIsProfit ? 'text-emerald-700' : 'text-rose-700'
          }`}
        >
          {formatFinancialCurrencyDetailed(projectedProfit)}
        </p>
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
        <div className={`mt-4 flex gap-2 rounded-xl border border-slate-200 bg-slate-50/80 px-3 py-3 ${toneClasses}`}>
          <DeltaImpactIcon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
          <div>
            <p className="text-sm font-bold">{deltaLine.label}</p>
            <p className="mt-0.5 font-mono text-base font-black tabular-nums">{deltaLine.amount}</p>
            {deltaLine.sub ? <p className="mt-1 text-xs font-normal text-slate-600">{deltaLine.sub}</p> : null}
          </div>
        </div>
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
