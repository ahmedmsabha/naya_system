'use client';

import type { ReactNode } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
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
  totalDeductions: number;
  netTotal: number;
  operatingExpenses: number;
  pnl: number;
  kpis: KpiCard[];
  insights: string[];
  pnlEntryTable: ReactNode;
};

type WaterfallRow = {
  label: string;
  offset: number;
  amount: number;
  delta: number;
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
  if (tone === 'good') return 'border-emerald-200 bg-emerald-50 text-emerald-700';
  if (tone === 'warning') return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-red-200 bg-red-50 text-red-700';
}

function buildWaterfallRows(
  grossSales: number,
  totalDeductions: number,
  operatingExpenses: number,
  pnl: number,
): WaterfallRow[] {
  const steps = [
    { label: 'Gross Sales', delta: grossSales, tone: 'positive' as const },
    { label: 'Deductions', delta: -Math.abs(totalDeductions), tone: 'negative' as const },
    { label: 'Operating Expenses', delta: -Math.abs(operatingExpenses), tone: 'negative' as const },
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
      tone: step.tone,
    };
  });

  rows.push({
    label: 'Net Profit',
    offset: 0,
    amount: Math.abs(pnl),
    delta: pnl,
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
  totalDeductions,
  netTotal,
  operatingExpenses,
  pnl,
  kpis,
  insights,
  pnlEntryTable,
}: ExecutiveFinancialDashboardProps) {
  const waterfallRows = buildWaterfallRows(grossSales, totalDeductions, operatingExpenses, pnl);

  const waterfallTooltipFormatter = (
    value: unknown,
    key: unknown,
    item: TooltipPayloadEntry,
  ) => {
    const row = item.payload as WaterfallRow | undefined;
    if (key === 'amount' && row) {
      return [formatCurrency(Math.abs(row.delta)), row.label];
    }
    return [formatCurrency(Number(value ?? 0)), String(key)];
  };

  return (
    <section className="space-y-7" dir="ltr">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="inline-flex items-center rounded-2xl border border-slate-200/80 bg-white p-1 shadow-sm">
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
          <p className="text-xs uppercase tracking-[0.22em] text-slate-500 font-semibold">
            Executive BI Dashboard
          </p>
          <h1 className="text-3xl md:text-4xl font-semibold tracking-tight text-slate-950 mt-1">
            {branchName}
          </h1>
          <p className="text-sm text-slate-500 mt-1">{selectedPeriod}</p>
          <Link
            href={varianceHref}
            className="mt-3 inline-flex items-center rounded-full border border-slate-300 bg-white px-4 py-2 text-xs font-semibold tracking-wide text-slate-900 hover:bg-slate-50"
          >
            Open Variance Intelligence
          </Link>
        </div>
      </div>

      <section className="grid grid-cols-1 xl:grid-cols-4 gap-5">
        {kpis.map((kpi) => (
          <article
            key={kpi.label}
            className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
              {kpi.label}
            </p>
            <p className="mt-2 text-4xl font-semibold tracking-tight text-slate-950">
              {formatPct(kpi.value)}
            </p>
            <p className="mt-2 text-sm text-slate-500">{kpi.description}</p>
            <span
              className={`mt-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${toneClasses(
                kpi.tone,
              )}`}
            >
              Target {formatPct(kpi.target)}
            </span>
          </article>
        ))}

        <section className="xl:col-span-1 rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_12px_30px_rgba(15,23,42,0.08)]">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
            AI Financial Commentary
          </p>
          <h3 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">
            Executive Insights
          </h3>
          <div className="mt-4 space-y-2">
            {insights.map((sentence, index) => (
              <article
                key={`${sentence}-${index}`}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm leading-6 text-slate-800"
              >
                {sentence}
              </article>
            ))}
          </div>
        </section>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-6 md:p-8 shadow-[0_14px_35px_rgba(15,23,42,0.1)]">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
              Waterfall View
            </p>
            <h2 className="text-2xl md:text-3xl font-semibold tracking-tight text-slate-950 mt-1">
              Gross Sales to Net Profit
            </h2>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-5 py-3">
            <p className="text-xs uppercase tracking-[0.18em] text-slate-500 font-semibold">
              Net Total
            </p>
            <p className="text-xl font-semibold text-emerald-700 mt-1">{formatCurrency(netTotal)}</p>
          </div>
        </div>

        <div className="h-[360px] mt-6">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={waterfallRows}
              margin={{ left: 4, right: 16, top: 12, bottom: 0 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
              <XAxis
                dataKey="label"
                stroke="#64748b"
                tick={{ fontSize: 12, fontWeight: 600 }}
              />
              <YAxis
                stroke="#64748b"
                tick={{ fontSize: 12 }}
                tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`}
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
              <Bar dataKey="offset" stackId="waterfall" fill="transparent" />
              <Bar dataKey="amount" stackId="waterfall" radius={[8, 8, 0, 0]}>
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

      <section className="rounded-[30px] border border-slate-200 bg-gradient-to-br from-white via-slate-50 to-slate-100 p-6 md:p-8 shadow-[0_16px_40px_rgba(15,23,42,0.1)]">
        <div className="mb-5">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500 font-semibold">
            Monthly P&L Ledger
          </p>
          <h3 className="text-2xl font-semibold tracking-tight text-slate-950 mt-1">
            Expense Entry and Receipt Control
          </h3>
        </div>
        {pnlEntryTable}
      </section>
    </section>
  );
}
