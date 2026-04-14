'use client';

import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  RadialBar,
  RadialBarChart,
  ResponsiveContainer,
  type TooltipProps,
  Tooltip,
  type TooltipPayloadEntry,
  XAxis,
  YAxis,
} from 'recharts';

type KpiCard = {
  label: string;
  value: number;
  target: number;
  description: string;
  tone: 'good' | 'warning' | 'danger';
};

type ExecutiveFinancialDashboardProps = {
  branchName: string;
  monthLabel: string;
  selectedPeriod: string;
  monthHrefPrev: string;
  monthHrefNext: string;
  varianceHref: string;
  grossSales: number;
  cogs: number;
  laborCost: number;
  opEx: number;
  netProfit: number;
  insights: string[];
  kpis: KpiCard[];
};

type WaterfallRow = {
  label: string;
  offset: number;
  amount: number;
  delta: number;
  after: number;
  tone: 'positive' | 'negative' | 'total';
};

function formatCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

function toneClasses(tone: KpiCard['tone']): string {
  if (tone === 'good')
    return 'text-emerald-600 bg-emerald-50 border-emerald-200';
  if (tone === 'warning')
    return 'text-amber-600 bg-amber-50 border-amber-200';
  return 'text-red-600 bg-red-50 border-red-200';
}

function getWaterfallRows(
  grossSales: number,
  cogs: number,
  laborCost: number,
  opEx: number,
  netProfit: number,
): WaterfallRow[] {
  const steps = [
    {
      label: 'Gross Sales',
      delta: grossSales,
      tone: 'positive' as const,
    },
    {
      label: 'COGS',
      delta: -cogs,
      tone: 'negative' as const,
    },
    {
      label: 'Labor',
      delta: -laborCost,
      tone: 'negative' as const,
    },
    {
      label: 'OpEx',
      delta: -opEx,
      tone: 'negative' as const,
    },
  ];

  let running = 0;
  const rows: WaterfallRow[] = steps.map((step) => {
    const before = running;
    const after = running + step.delta;
    running = after;
    return {
      label: step.label,
      offset: Math.min(before, after),
      amount: Math.abs(step.delta),
      delta: step.delta,
      after,
      tone: step.tone,
    };
  });

  rows.push({
    label: 'Net Profit',
    offset: 0,
    amount: Math.abs(netProfit),
    delta: netProfit,
    after: netProfit,
    tone: 'total',
  });

  return rows;
}

export function ExecutiveFinancialDashboard({
  branchName,
  monthLabel,
  selectedPeriod,
  monthHrefPrev,
  monthHrefNext,
  varianceHref,
  grossSales,
  cogs,
  laborCost,
  opEx,
  netProfit,
  insights,
  kpis,
}: ExecutiveFinancialDashboardProps) {
  const gaugeTooltipFormatter: NonNullable<
    TooltipProps['formatter']
  > = (value) => formatPct(Number(value));

  const waterfallTooltipFormatter: NonNullable<
    TooltipProps['formatter']
  > = (value, key, item) => {
    const payloadEntry = item as TooltipPayloadEntry;
    const row = payloadEntry.payload as WaterfallRow | undefined;
    if (key === 'amount' && row) {
      return [formatCurrency(Math.abs(row.delta)), row.label];
    }
    return [formatCurrency(Number(value)), String(key)];
  };

  const waterfallRows = getWaterfallRows(
    grossSales,
    cogs,
    laborCost,
    opEx,
    netProfit,
  );

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
            Executive BI Dashboard
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-950 mt-1">
            {branchName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {selectedPeriod}
          </p>
          <Link
            href={varianceHref}
            className="mt-3 inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-900 hover:bg-slate-50"
          >
            Open Variance Intelligence
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_6px_24px_rgba(15,23,42,0.06)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
                  {kpi.label}
                </p>
                <p className="text-4xl font-semibold tracking-tight text-slate-950 mt-2">
                  {formatPct(kpi.value)}
                </p>
                <p className="text-sm text-slate-500 mt-2">
                  {kpi.description}
                </p>
              </div>
              <span
                className={`inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(kpi.tone)}`}
              >
                Target {formatPct(kpi.target)}
              </span>
            </div>

            <div className="h-40 mt-3">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <RadialBarChart
                  data={[
                    {
                      value: Math.max(
                        0,
                        Math.min(100, kpi.value),
                      ),
                    },
                  ]}
                  cx="50%"
                  cy="55%"
                  innerRadius="65%"
                  outerRadius="100%"
                  startAngle={180}
                  endAngle={0}
                  barSize={12}
                >
                  <RadialBar
                    dataKey="value"
                    cornerRadius={12}
                    fill="#0f172a"
                  />
                  <Tooltip
                    formatter={gaugeTooltipFormatter}
                    contentStyle={{
                      borderRadius: 12,
                      border: '1px solid #e2e8f0',
                      fontSize: 12,
                    }}
                  />
                </RadialBarChart>
              </ResponsiveContainer>
            </div>
          </article>
        ))}
      </div>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
              Profit Bridge
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-950 mt-1">
              Waterfall: Gross Sales to Net Profit
            </h2>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
              Net Profit
            </p>
            <p className="text-2xl font-semibold text-slate-950 mt-1">
              {formatCurrency(netProfit)}
            </p>
          </div>
        </div>

        <div className="h-[360px] mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={waterfallRows}
              margin={{
                left: 4,
                right: 18,
                top: 12,
                bottom: 0,
              }}
            >
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="#e2e8f0"
              />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tick={{ fontSize: 12, fontWeight: 500 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) =>
                  `$${Number(value) / 1000}k`
                }
              />
              <Tooltip
                formatter={waterfallTooltipFormatter}
                labelFormatter={(label) => String(label)}
                contentStyle={{
                  borderRadius: 12,
                  border: '1px solid #e2e8f0',
                  fontSize: 12,
                }}
              />
              <Bar
                dataKey="offset"
                stackId="waterfall"
                fill="transparent"
              />
              <Bar
                dataKey="amount"
                stackId="waterfall"
                radius={[8, 8, 0, 0]}
              >
                {waterfallRows.map((row) => (
                  <Cell
                    key={row.label}
                    fill={
                      row.tone === 'positive'
                        ? '#0ea5e9'
                        : row.tone === 'negative'
                          ? '#ef4444'
                          : '#10b981'
                    }
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_10px_30px_rgba(15,23,42,0.08)]">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
          AI Financial Commentary
        </p>
        <h3 className="text-2xl font-semibold tracking-tight text-slate-950 mt-1">
          Executive Insights
        </h3>
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
