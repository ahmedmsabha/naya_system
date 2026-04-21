'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { usePathname } from 'next/navigation';
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react';
import { addMonths, monthLabel } from '@/lib/domain/date';
import {
  branchFinancialsSectionHref,
  FINANCIALS_SECTIONS,
  FINANCIALS_SECTION_IDS,
  type FinancialsSectionId,
} from '@/components/finance/financials-dashboard/financials-sections';
import { useFinancialsDashboard } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';
import { formatFinancialCurrency, formatFinancialPct } from '@/components/finance/financials-dashboard/financials-format';
import { isNetLoss, netProfitLossLabel } from '@/lib/domain/money';

function parseSectionFromPath(pathname: string): FinancialsSectionId {
  const m = pathname.match(/\/financials\/([^/]+)/);
  const raw = m?.[1];
  if (raw && (FINANCIALS_SECTION_IDS as readonly string[]).includes(raw)) {
    return raw as FinancialsSectionId;
  }
  return 'performance';
}

export function FinancialsLayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const section = parseSectionFromPath(pathname);
  const {
    branchId,
    branchName,
    selectedPeriod,
    grossSales,
    totalDeductions,
    pnl,
    kpis,
  } = useFinancialsDashboard();

  const [isBraCollapsed, setIsBraCollapsed] = useState(false);

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

  const leakScore = Math.max(
    0,
    Math.min(100, (totalDeductions / Math.max(1, grossSales)) * 100),
  );

  const monthLabelText = monthLabel(selectedPeriod);
  const monthHrefPrev = branchFinancialsSectionHref(
    branchId,
    section,
    addMonths(selectedPeriod, -1),
  );
  const monthHrefNext = branchFinancialsSectionHref(
    branchId,
    section,
    addMonths(selectedPeriod, 1),
  );

  return (
    <section className="space-y-6 pb-24 lg:pb-0" dir="ltr">
      <div className="flex flex-col gap-5 lg:flex-row">
        <div className="min-w-0 flex-1 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <Link
                href={`/branch/${branchId}`}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Branch
              </Link>
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
              <span className="rounded-full bg-slate-900 px-3 py-1.5 font-semibold text-white">
                {monthLabelText}
              </span>
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
              <p className="mt-2 text-4xl font-black text-[#052e36]">
                {formatFinancialCurrency(grossSales)}
              </p>
            </article>
            <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">Total Deductions</p>
              <p className="mt-2 text-4xl font-black text-[#052e36]">
                {formatFinancialCurrency(totalDeductions)}
              </p>
            </article>
            <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">{netProfitLossLabel(pnl)}</p>
              <p
                className={`mt-2 text-4xl font-black ${isNetLoss(pnl) ? 'text-rose-700' : 'text-emerald-700'}`}
              >
                {formatFinancialCurrency(pnl)}
              </p>
            </article>
            <article className="rounded-3xl border border-gray-200 bg-white p-5 shadow-sm">
              <p className="text-xs text-slate-500">Net Margin</p>
              <p
                className={`mt-2 text-4xl font-black ${
                  isNetLoss(pnl) ? 'text-rose-700' : 'text-[#052e36]'
                }`}
              >
                {formatFinancialPct(kpis[0]?.value ?? 0)}
              </p>
            </article>
          </section>

          <section className="rounded-3xl border border-rose-200 bg-rose-50 px-5 py-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-lg font-bold text-rose-700">Leak Detector Alert</h2>
              <span className="rounded-full bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">
                {formatFinancialPct(leakScore)} of revenue
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2 text-xs text-rose-700">
              {costDistribution.slice(0, 2).map((item) => (
                <span
                  key={item.name}
                  className="rounded-full border border-rose-200 bg-white px-2 py-1"
                >
                  {item.name} : {formatFinancialPct(item.value)}
                </span>
              ))}
            </div>
          </section>

          <div className="min-w-0 scroll-mt-6">{children}</div>
        </div>

        <aside
          className={`hidden rounded-3xl border border-gray-200 bg-white p-3 shadow-sm transition-all duration-300 lg:sticky lg:top-6 lg:block lg:h-fit ${
            isBraCollapsed ? 'lg:w-[84px]' : 'lg:w-[220px]'
          }`}
        >
          <div
            className={`mb-6 flex items-start ${isBraCollapsed ? 'justify-center px-0 pt-2' : 'justify-between px-3 pt-2'}`}
          >
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
            {FINANCIALS_SECTIONS.map(({ id, label, icon: Icon }) => {
              const isActive = id === section;
              const href = branchFinancialsSectionHref(branchId, id, selectedPeriod);
              return (
                <Link
                  key={id}
                  href={href}
                  title={label}
                  className={`flex w-full items-center justify-between rounded-2xl px-3 py-2 text-sm transition ${
                    isActive
                      ? 'bg-cyan-500 text-slate-950'
                      : 'bg-transparent text-slate-700 hover:bg-slate-100'
                  } ${isBraCollapsed ? 'justify-center px-2' : ''}`}
                >
                  {isBraCollapsed ? null : <span>{label}</span>}
                  <Icon className="h-4 w-4" />
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>

      <div className="fixed inset-x-0 bottom-3 z-40 px-3 lg:hidden">
        <nav className="mx-auto flex max-w-3xl items-center gap-2 overflow-x-auto rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-lg backdrop-blur">
          {FINANCIALS_SECTIONS.map(({ id, label, icon: Icon }) => {
            const isActive = id === section;
            const href = branchFinancialsSectionHref(branchId, id, selectedPeriod);
            return (
              <Link
                key={`mobile-${id}`}
                href={href}
                className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  isActive
                    ? 'bg-cyan-500 text-slate-950'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                <Icon className="h-4 w-4" />
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </section>
  );
}
