'use client';

import { useMemo } from 'react';
import { exportInvestorReportPDF } from '@/lib/finance/InvestorReportPDF';
import { useFinancialsDashboard } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';
import { formatFinancialCurrency, formatFinancialPct } from '@/components/finance/financials-dashboard/financials-format';
import { netProfitLossLabel } from '@/lib/domain/money';
import { monthLabel } from '@/lib/domain/date';

export function InvestorPortalSection() {
  const {
    branchName,
    selectedPeriod,
    grossSales,
    totalDeductions,
    operatingExpenses,
    pnl,
    kpis,
  } = useFinancialsDashboard();

  const kpiByLabel = useMemo(() => new Map(kpis.map((item) => [item.label, item])), [kpis]);
  const netMarginPct = kpiByLabel.get('Net Margin')?.value ?? 0;

  const baselineRevenue = useMemo(
    () => Math.max(grossSales, Math.abs(pnl), 10000),
    [grossSales, pnl],
  );
  const baselineOpex = useMemo(
    () => Math.max(operatingExpenses, totalDeductions, Math.abs(pnl) * 0.25, 5000),
    [operatingExpenses, totalDeductions, pnl],
  );

  const projectedRevenue = baselineRevenue;
  const projectedOpex = baselineOpex;
  const projectedProfit = projectedRevenue - projectedOpex - totalDeductions;
  const projectedRoi = projectedRevenue > 0 ? (projectedProfit / projectedRevenue) * 100 : 0;
  const investorValuation = Math.max(0, projectedProfit * 12);
  const retentionIndex = Math.max(0, Math.min(100, 55 + (projectedRoi - 10)));

  const monthLabelText = monthLabel(selectedPeriod);

  const onExportInvestorPdf = () => {
    exportInvestorReportPDF({
      branchName,
      monthLabel: monthLabelText,
      projectedValuation: investorValuation,
      projectedProfit,
      projectedRoi,
      retentionIndex,
      metrics: [
        { label: `Current ${netProfitLossLabel(pnl)}`, value: formatFinancialCurrency(pnl) },
        { label: 'Current Net Margin', value: formatFinancialPct(netMarginPct) },
        { label: 'Operating Expenses', value: formatFinancialCurrency(operatingExpenses) },
        { label: 'Total Deductions', value: formatFinancialCurrency(totalDeductions) },
      ],
    });
  };

  return (
    <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-xs text-gray-500">Projected Business Valuation</p>
        <p className="mt-3 text-5xl font-black text-[#052e36]">{formatFinancialCurrency(investorValuation)}</p>
        <p className="mt-2 text-sm text-gray-600">Based on current run-rate and operating improvements.</p>
        <button
          type="button"
          className="mt-6 rounded-2xl bg-[#052e36] px-5 py-3 text-sm font-bold text-white"
          onClick={onExportInvestorPdf}
        >
          Refresh Investor PDF
        </button>
      </article>
      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-[#052e36]">Investment Value Analysis</h3>
        <div className="mt-5 space-y-4">
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>Return on Assets (ROA)</span>
              <span>{formatFinancialPct(Math.max(0, projectedRoi * 0.75))}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-cyan-400"
                style={{ width: `${Math.max(0, Math.min(100, projectedRoi * 2))}%` }}
              />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>Investor Retention Index</span>
              <span>{formatFinancialPct(retentionIndex)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div className="h-full rounded-full bg-violet-400" style={{ width: `${retentionIndex}%` }} />
            </div>
          </div>
          <div>
            <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
              <span>Net Margin</span>
              <span>{formatFinancialPct(netMarginPct)}</span>
            </div>
            <div className="h-2 rounded-full bg-slate-200">
              <div
                className="h-full rounded-full bg-emerald-400"
                style={{ width: `${Math.max(0, Math.min(100, netMarginPct))}%` }}
              />
            </div>
          </div>
        </div>
      </article>
    </section>
  );
}
