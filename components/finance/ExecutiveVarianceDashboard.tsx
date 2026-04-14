'use client';

import Link from 'next/link';
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  type TooltipProps,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

type LossSource = {
  ingredient: string;
  monetaryVariance: number;
  variancePercent: number;
};

type MatrixRow = {
  ingredient: string;
  unit: string;
  idealUsage: number;
  actualUsage: number;
  varianceAmount: number;
  variancePercent: number;
  monetaryVariance: number;
};

type ExecutiveVarianceDashboardProps = {
  branchName: string;
  selectedPeriod: string;
  monthLabel: string;
  monthHrefPrev: string;
  monthHrefNext: string;
  financialsHref: string;
  topLossSources: LossSource[];
  matrixRows: MatrixRow[];
  insights: string[];
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat('en-US', {
    notation: 'compact',
    maximumFractionDigits: 1,
  }).format(value);
}

function formatQty(value: number): string {
  return new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 2,
  }).format(value);
}

function varianceBadgeClass(variancePercent: number): string {
  const abs = Math.abs(variancePercent);
  if (abs > 8) return 'bg-red-600 text-white';
  if (abs > 5) return 'bg-amber-500 text-white';
  return 'bg-emerald-100 text-emerald-700';
}

export function ExecutiveVarianceDashboard({
  branchName,
  selectedPeriod,
  monthLabel,
  monthHrefPrev,
  monthHrefNext,
  financialsHref,
  topLossSources,
  matrixRows,
  insights,
}: ExecutiveVarianceDashboardProps) {
  const paretoTooltipFormatter: NonNullable<
    TooltipProps['formatter']
  > = (value, key) => {
    if (key === 'loss') {
      return [formatCurrency(Number(value)), 'Monetary Variance'];
    }
    return [`${Number(value).toFixed(1)}%`, 'Cumulative Share'];
  };

  const totalPareto = topLossSources.reduce((sum, row) => sum + Math.max(0, row.monetaryVariance), 0);
  const paretoRows = topLossSources.map((row, index) => {
    const loss = Math.max(0, row.monetaryVariance);
    const runningLoss = topLossSources
      .slice(0, index + 1)
      .reduce((sum, item) => sum + Math.max(0, item.monetaryVariance), 0);
    const cumulative = totalPareto > 0 ? (runningLoss / totalPareto) * 100 : 0;
    return {
      ingredient: row.ingredient,
      loss,
      cumulative,
      variancePercent: row.variancePercent,
    };
  });

  return (
    <section className="space-y-6" dir="ltr">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex items-center rounded-2xl border border-slate-200 bg-white p-1 shadow-sm">
          <Link
            href={monthHrefPrev}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Previous Month
          </Link>
          <div className="px-5 py-2 rounded-xl text-sm font-bold bg-slate-900 text-white min-w-[170px] text-center">
            {monthLabel}
          </div>
          <Link
            href={monthHrefNext}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-slate-600 hover:text-slate-900"
          >
            Next Month
          </Link>
        </div>

        <div className="text-right">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Variance Intelligence
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-950 mt-1">
            {branchName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{selectedPeriod}</p>
          <Link
            href={financialsHref}
            className="mt-3 inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-900 hover:bg-slate-50"
          >
            Back to Financial Dashboard
          </Link>
        </div>
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
              Pareto Principle (80/20)
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-950 mt-1">
              Top Loss Sources
            </h2>
            <p className="text-sm text-slate-500 mt-2">Top 5 ingredients driving the largest financial variance.</p>
          </div>
        </div>

        <div className="h-[340px] mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={paretoRows} margin={{ left: 8, right: 14, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis dataKey="ingredient" stroke="#64748b" tick={{ fontSize: 12 }} />
              <YAxis
                yAxisId="left"
                stroke="#64748b"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${formatCompact(Number(value))}`}
              />
              <YAxis
                yAxisId="right"
                orientation="right"
                stroke="#64748b"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `${Number(value).toFixed(0)}%`}
              />
              <Tooltip
                formatter={paretoTooltipFormatter}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              />
              <Legend />
              <Bar yAxisId="left" dataKey="loss" name="Monetary Variance" fill="#ef4444" radius={[8, 8, 0, 0]} />
              <Line
                yAxisId="right"
                type="monotone"
                dataKey="cumulative"
                name="Cumulative Share"
                stroke="#0ea5e9"
                strokeWidth={3}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
              Ingredient Efficiency Matrix
            </p>
            <h3 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-950 mt-1">
              Ideal vs Actual Usage
            </h3>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-700">
            High-risk threshold: variance above 5%
          </div>
        </div>

        <div className="mt-5 overflow-x-auto">
          <table className="w-full min-w-[980px]">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-[0.16em] text-slate-500">
                <th className="py-3 pr-3">Ingredient</th>
                <th className="py-3 pr-3">Ideal Usage (Recipe)</th>
                <th className="py-3 pr-3">Actual Usage (Inventory)</th>
                <th className="py-3 pr-3">Variance Amount</th>
                <th className="py-3 pr-3">Variance %</th>
                <th className="py-3 pr-0">Monetary Variance</th>
              </tr>
            </thead>
            <tbody>
              {matrixRows.map((row) => (
                <tr key={row.ingredient} className="border-b border-slate-100">
                  <td className="py-4 pr-3 text-sm font-semibold text-slate-900">{row.ingredient}</td>
                  <td className="py-4 pr-3 text-sm text-slate-700">
                    {formatQty(row.idealUsage)} {row.unit}
                  </td>
                  <td className="py-4 pr-3 text-sm text-slate-700">
                    {formatQty(row.actualUsage)} {row.unit}
                  </td>
                  <td className="py-4 pr-3 text-sm font-semibold text-slate-900">
                    {formatQty(row.varianceAmount)} {row.unit}
                  </td>
                  <td className="py-4 pr-3">
                    <span
                      className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${varianceBadgeClass(row.variancePercent)}`}
                    >
                      {row.variancePercent.toFixed(1)}%
                    </span>
                  </td>
                  <td className="py-4 pr-0 text-sm font-semibold text-slate-900">
                    {formatCurrency(row.monetaryVariance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
          AI Financial Commentary
        </p>
        <h3 className="text-2xl font-semibold tracking-tight text-slate-950 mt-1">Variance Insights</h3>
        <div className="mt-5 grid gap-3 md:grid-cols-3">
          {insights.map((sentence, index) => (
            <article
              key={`${sentence}-${index}`}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 text-sm leading-6 text-slate-800"
            >
              {sentence}
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}
