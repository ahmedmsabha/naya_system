'use client';

import Link from 'next/link';
import { useFinancialsDashboard } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';
import { formatFinancialCurrency } from '@/components/finance/financials-dashboard/financials-format';
import { isNetLoss, netProfitLossLabel } from '@/lib/domain/money';

export function RevenueUnitSection() {
  const {
    branchId,
    grossSales,
    totalDeductions,
    netTotal,
    operatingExpenses,
    pnl,
    insights,
    selectedPeriod,
  } = useFinancialsDashboard();

  const topInsights = insights.slice(0, 3);
  const varianceHref = `/branch/${branchId}/financials/variance?period=${encodeURIComponent(selectedPeriod)}`;

  return (
    <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h3 className="text-xl font-bold text-[#052e36]">Revenue Unit</h3>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Gross Revenue</p>
            <p className="mt-2 text-2xl font-black text-[#052e36]">
              {formatFinancialCurrency(grossSales)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Net Revenue</p>
            <p className="mt-2 text-2xl font-black text-[#052e36]">
              {formatFinancialCurrency(netTotal)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">Operating Expenses</p>
            <p className="mt-2 text-2xl font-black text-[#052e36]">
              {formatFinancialCurrency(operatingExpenses)}
            </p>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-xs text-slate-500">
              {netProfitLossLabel(pnl)} (EBITDA)
            </p>
            <p
              className={`mt-2 text-2xl font-black ${isNetLoss(pnl) ? 'text-rose-700' : 'text-emerald-700'}`}
            >
              {formatFinancialCurrency(pnl)}
            </p>
          </div>
        </div>
        <div className="mt-3 text-[11px] text-slate-500">
          Net revenue = gross sales − deductions ({formatFinancialCurrency(totalDeductions)}).
        </div>
        <Link
          href={varianceHref}
          className="mt-5 inline-flex rounded-full border border-cyan-400/70 px-4 py-2 text-xs font-semibold text-cyan-700 hover:bg-cyan-50"
        >
          Open Variance Intelligence
        </Link>
      </article>
      <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
        <h4 className="text-lg font-bold text-[#052e36]">AI Financial Commentary</h4>
        <div className="mt-4 space-y-2">
          {topInsights.map((sentence, index) => (
            <p
              key={`${sentence}-${index}`}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
            >
              {sentence}
            </p>
          ))}
        </div>
      </article>
    </section>
  );
}
