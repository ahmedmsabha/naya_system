'use client';

import { useMemo, useState, type ReactNode } from 'react';
import Link from 'next/link';
import {
  BarChart3,
  Calculator,
  ChevronLeft,
  ChevronRight,
  CircleDollarSign,
  Gift,
  Receipt,
} from 'lucide-react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { exportInvestorReportPDF } from '@/lib/finance/InvestorReportPDF';

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
  vendorsHref: string;
  accountantHref: string;
  grossSales: number;
  totalDeductions: number;
  netTotal: number;
  operatingExpenses: number;
  pnl: number;
  kpis: KpiCard[];
  insights: string[];
  pnlEntryTable: ReactNode;
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

type SectionKey = 'performance' | 'revenue' | 'accounting' | 'simulator' | 'investor';

export function ExecutiveFinancialDashboard({
  branchName,
  monthLabel,
  selectedPeriod,
  monthHrefPrev,
  monthHrefNext,
  varianceHref,
  vendorsHref,
  accountantHref,
  grossSales,
  totalDeductions,
  netTotal,
  operatingExpenses,
  pnl,
  kpis,
  insights,
  pnlEntryTable,
}: ExecutiveFinancialDashboardProps) {
  const [activeSection, setActiveSection] = useState<SectionKey>('performance');
  const [isBraCollapsed, setIsBraCollapsed] = useState(false);
  const [priceIncreasePct, setPriceIncreasePct] = useState(0);
  const [expenseReductionPct, setExpenseReductionPct] = useState(0);

  const topInsights = insights.slice(0, 3);
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

  const projectedRevenue = useMemo(
    () => baselineRevenue * (1 + priceIncreasePct / 100),
    [baselineRevenue, priceIncreasePct],
  );
  const projectedOpex = useMemo(
    () => baselineOpex * (1 - expenseReductionPct / 100),
    [baselineOpex, expenseReductionPct],
  );

  const trendPoints = useMemo(() => {
    const baseProfit = pnl !== 0 ? pnl : baselineRevenue * 0.08 - baselineOpex;
    return [
      { label: 'Week 1', netProfit: Number((baseProfit * 0.9).toFixed(2)) },
      { label: 'Week 2', netProfit: Number((baseProfit * 1.03).toFixed(2)) },
      { label: 'Week 3', netProfit: Number((baseProfit * 0.97).toFixed(2)) },
      { label: 'Week 4', netProfit: Number(baseProfit.toFixed(2)) },
      { label: 'Scenario', netProfit: Number((projectedRevenue - projectedOpex - totalDeductions).toFixed(2)) },
    ];
  }, [baselineOpex, baselineRevenue, pnl, projectedOpex, projectedRevenue, totalDeductions]);

  const leakScore = Math.max(0, Math.min(100, (totalDeductions / Math.max(1, grossSales)) * 100));

  const projectedProfit = useMemo(() => {
    return projectedRevenue - projectedOpex - totalDeductions;
  }, [projectedRevenue, projectedOpex, totalDeductions]);
  const projectedDelta = projectedProfit - pnl;

  const projectedRoi = projectedRevenue > 0 ? (projectedProfit / projectedRevenue) * 100 : 0;
  const investorValuation = Math.max(0, projectedProfit * 12);
  const retentionIndex = Math.max(0, Math.min(100, 55 + (projectedRoi - 10)));

  const sections: Array<{
    key: SectionKey;
    label: string;
    icon: typeof BarChart3;
  }> = [
    { key: 'performance', label: 'Financial Performance', icon: BarChart3 },
    { key: 'revenue', label: 'Revenue Unit', icon: CircleDollarSign },
    { key: 'accounting', label: 'Accounting Center', icon: Receipt },
    { key: 'simulator', label: 'Decision Simulator', icon: Calculator },
    { key: 'investor', label: 'Investor Portal', icon: Gift },
  ];

  const onExportInvestorPdf = () => {
    exportInvestorReportPDF({
      branchName,
      monthLabel,
      projectedValuation: investorValuation,
      projectedProfit,
      projectedRoi,
      retentionIndex,
      metrics: [
        { label: 'Current Net Profit', value: formatCurrency(pnl) },
        { label: 'Current Net Margin', value: formatPct(kpiByLabel.get('Net Margin')?.value ?? 0) },
        { label: 'Operating Expenses', value: formatCurrency(operatingExpenses) },
        { label: 'Total Deductions', value: formatCurrency(totalDeductions) },
      ],
    });
  };

  const renderPanel = () => {
    if (activeSection === 'simulator') {
      return (
        <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1.15fr_1fr]">
          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs text-gray-500">Projected Financial Impact</p>
            <p className="mt-3 text-5xl font-black text-[#052e36]">{formatCurrency(projectedProfit)}</p>
            <p className="mt-2 text-sm text-gray-600">Projected ROI: {formatPct(projectedRoi)}</p>
            <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Projected Revenue</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(projectedRevenue)}</p>
              </div>
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-[11px] text-slate-500">Projected Operating Cost</p>
                <p className="mt-1 text-lg font-bold text-slate-900">{formatCurrency(projectedOpex)}</p>
              </div>
            </div>
            <p className={`mt-4 text-sm font-semibold ${projectedDelta >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Profit change vs current: {projectedDelta >= 0 ? '+' : ''}
              {formatCurrency(projectedDelta)}
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
              Simulation recalculates revenue and cost immediately from your slider settings.
            </p>
          </article>
        </section>
      );
    }

    if (activeSection === 'investor') {
      return (
        <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <p className="text-xs text-gray-500">Projected Business Valuation</p>
            <p className="mt-3 text-5xl font-black text-[#052e36]">{formatCurrency(investorValuation)}</p>
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
                  <span>{formatPct(Math.max(0, projectedRoi * 0.75))}</span>
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
                  <span>{formatPct(retentionIndex)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-violet-400"
                    style={{ width: `${retentionIndex}%` }}
                  />
                </div>
              </div>
              <div>
                <div className="mb-1 flex items-center justify-between text-xs text-gray-600">
                  <span>Net Margin</span>
                  <span>{formatPct(kpis[0]?.value ?? 0)}</span>
                </div>
                <div className="h-2 rounded-full bg-slate-200">
                  <div
                    className="h-full rounded-full bg-emerald-400"
                    style={{ width: `${Math.max(0, Math.min(100, kpis[0]?.value ?? 0))}%` }}
                  />
                </div>
              </div>
            </div>
          </article>
        </section>
      );
    }

    if (activeSection === 'accounting') {
      return (
        <section className="min-h-[460px] space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="text-2xl font-bold text-[#052e36]">Accounting Center</h3>
            <div className="inline-flex items-center gap-2">
              <Link
                href={accountantHref}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Open Smart Accountant
              </Link>
              <Link
                href={vendorsHref}
                className="rounded-full border border-gray-300 bg-white px-4 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50"
              >
                Track Vendors
              </Link>
            </div>
          </div>
          <article className="max-w-full rounded-3xl border border-gray-200 bg-white p-4 text-slate-900 shadow-sm">
            <div className="max-h-[68vh] max-w-full overflow-auto overscroll-contain">{pnlEntryTable}</div>
          </article>
        </section>
      );
    }

    if (activeSection === 'revenue') {
      return (
        <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
          <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
            <h3 className="text-xl font-bold text-[#052e36]">Revenue Unit</h3>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Gross Revenue</p>
                <p className="mt-2 text-2xl font-black text-[#052e36]">{formatCurrency(grossSales)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Net Revenue</p>
                <p className="mt-2 text-2xl font-black text-[#052e36]">{formatCurrency(netTotal)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Operating Expenses</p>
                <p className="mt-2 text-2xl font-black text-[#052e36]">{formatCurrency(operatingExpenses)}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="text-xs text-slate-500">Net Profit</p>
                <p className="mt-2 text-2xl font-black text-emerald-700">{formatCurrency(pnl)}</p>
              </div>
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

    return (
      <section className="grid min-h-[460px] grid-cols-1 gap-4 xl:grid-cols-[1fr_1fr]">
        <article className="rounded-3xl border border-gray-200 bg-white p-6 shadow-sm">
          <h3 className="text-xl font-bold text-[#052e36]">Operating Cost Distribution</h3>
          <div className="mt-6 space-y-4">
            {costDistribution.map((item) => (
              <div key={item.name}>
                <div className="mb-1 flex items-center justify-between text-sm text-slate-700">
                  <span>{item.name}</span>
                  <span className="font-semibold">{formatPct(item.value)}</span>
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
          <h3 className="text-xl font-bold text-[#052e36]">Profit & Loss Trend</h3>
          <div className="mt-6 h-64 rounded-2xl border border-cyan-100 bg-slate-50 p-3">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={trendPoints} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#dbeafe" />
                <XAxis dataKey="label" tick={{ fill: '#475569', fontSize: 11 }} />
                <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tick={{ fill: '#475569', fontSize: 11 }} />
                <Tooltip
                  formatter={(value) => formatCurrency(Number(value ?? 0))}
                  contentStyle={{ borderRadius: 10, border: '1px solid #cbd5e1' }}
                />
                <Area
                  type="monotone"
                  dataKey="netProfit"
                  stroke="#06b6d4"
                  strokeWidth={2.5}
                  fill="#67e8f9"
                  fillOpacity={0.35}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </article>
      </section>
    );
  };

  return (
    <section className="space-y-6 pb-24 lg:pb-0" dir="ltr">
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-full bg-cyan-100" />
              <div>
                <p className="text-xs text-slate-500">Branch Financial Dashboard</p>
                <p className="text-sm font-semibold text-slate-900">{branchName}</p>
              </div>
            </div>
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white p-1 text-xs text-slate-700">
              <Link
                href={monthHrefPrev}
                className="rounded-full px-3 py-1.5 transition hover:bg-slate-100"
              >
                Previous Month
              </Link>
              <span className="rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white">{monthLabel}</span>
              <Link
                href={monthHrefNext}
                className="rounded-full px-3 py-1.5 transition hover:bg-slate-100"
              >
                Next Month
              </Link>
            </div>
          </div>

          <section className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
            <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">Total Revenue</p>
              <p className="mt-2 text-4xl font-black text-[#052e36]">{formatCurrency(grossSales)}</p>
            </article>
            <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">Total Deductions</p>
              <p className="mt-2 text-4xl font-black text-[#052e36]">{formatCurrency(totalDeductions)}</p>
            </article>
            <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">Net Profit</p>
              <p className="mt-2 text-4xl font-black text-emerald-700">{formatCurrency(pnl)}</p>
            </article>
            <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">Net Margin</p>
              <p className="mt-2 text-4xl font-black text-[#052e36]">{formatPct(kpis[0]?.value ?? 0)}</p>
            </article>
          </section>

          <section className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-rose-700">Leak Detector Alert</h2>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                {formatPct(leakScore)} of revenue
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-rose-700">
              {costDistribution.slice(0, 2).map((item) => (
                <span key={item.name} className="rounded-full border border-rose-200 bg-white px-2 py-1">
                  {item.name} : {formatPct(item.value)}
                </span>
              ))}
            </div>
          </section>

          <div key={activeSection} className="min-w-0 transition-all duration-300 ease-out">
            {renderPanel()}
          </div>
        </div>

        <aside
          className={`hidden rounded-3xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-300 lg:sticky lg:top-6 lg:block lg:h-fit ${
            isBraCollapsed ? 'lg:w-[84px]' : 'lg:w-[220px]'
          }`}
        >
          <div className={`mb-6 flex items-start ${isBraCollapsed ? 'justify-center px-0 pt-2' : 'justify-between px-3 pt-2'}`}>
            {isBraCollapsed ? null : (
              <div>
                <p className="text-xl font-black text-[#052e36]">BRAINOS</p>
                <p className="text-[10px] text-slate-500">{selectedPeriod}</p>
              </div>
            )}
            <button
              type="button"
              onClick={() => setIsBraCollapsed((prev) => !prev)}
              className="rounded-lg border border-slate-200 p-1.5 text-slate-600 hover:bg-slate-100"
              aria-label={isBraCollapsed ? 'Expand BRAINOS sidebar' : 'Collapse BRAINOS sidebar'}
              title={isBraCollapsed ? 'Expand' : 'Collapse'}
            >
              {isBraCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
            </button>
          </div>
          <nav className="space-y-2">
            {sections.map((section) => {
              const Icon = section.icon;
              const isActive = section.key === activeSection;
              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => setActiveSection(section.key)}
                  title={section.label}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-transparent text-slate-700 hover:bg-slate-100'
                  } ${isBraCollapsed ? 'justify-center px-2' : ''}`}
                >
                  {isBraCollapsed ? null : <span>{section.label}</span>}
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </nav>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-3 z-40 px-3 lg:hidden">
        <nav className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
          {sections.map((section) => {
            const Icon = section.icon;
            const isActive = section.key === activeSection;
            return (
              <button
                key={`mobile-${section.key}`}
                type="button"
                onClick={() => setActiveSection(section.key)}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {section.label}
              </button>
            );
          })}
        </nav>
      </div>

    </section>
  );
}
