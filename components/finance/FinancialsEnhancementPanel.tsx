'use client';

import { useActionState, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from 'recharts';
import { Loader2, PlusCircle, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { formatCurrency } from '@/lib/domain/money';
import type { MonthlyPnLCategory } from '@/lib/finance/monthly-pnl';
import { MONTHLY_PNL_ALL_CATEGORIES } from '@/lib/finance/monthly-pnl';
import { addExpenseEntryAction, addRevenueEntryAction } from '@/app/(dashboard)/branch/[id]/financials/commands';
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart';

type MatrixStatus = 'ON TARGET' | 'CRITICAL INCREASE' | 'UNDER BUDGET';
type MatrixTone = 'emerald' | 'rose' | 'amber';

type MatrixRow = {
  label: string;
  amount: number;
  pct: number;
  status: {
    label: MatrixStatus;
    tone: MatrixTone;
  };
};

type FinancialsEnhancementPanelProps = {
  branchId: string;
  selectedPeriod: string;
  varianceHref: string;
  vendorsHref: string;
  recipes: Array<{ id: string; name: string; sellingPrice: number }>;
  deliverySales: number;
  dineInSales: number;
  averageTicket: number;
  weeklySalesSeries: Array<{ label: string; delivery: number; takeaway: number }>;
  matrixRows: MatrixRow[];
  baseline: {
    netSales: number;
    cogs: number;
    operationsCost: number;
    ebitda: number;
  };
};

const salesChartConfig = {
  delivery: { label: 'Delivery', color: '#0EA5E9' },
  takeaway: { label: 'Takeaway', color: '#1E293B' },
} satisfies ChartConfig;

function SubmitButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#052e36] px-4 py-2.5 text-xs font-black uppercase tracking-[0.18em] text-white shadow-lg shadow-slate-300/40 disabled:opacity-60"
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlusCircle className="h-4 w-4" />}
      {pending ? 'Saving...' : label}
    </button>
  );
}

function toneClasses(tone: MatrixTone): string {
  if (tone === 'emerald') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (tone === 'rose') return 'bg-rose-50 text-rose-700 border-rose-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
}

export function FinancialsEnhancementPanel({
  branchId,
  selectedPeriod,
  varianceHref,
  vendorsHref,
  recipes,
  deliverySales,
  dineInSales,
  averageTicket,
  weeklySalesSeries,
  matrixRows,
  baseline,
}: FinancialsEnhancementPanelProps) {
  const [selectedRecipeId, setSelectedRecipeId] = useState(recipes[0]?.id ?? '');
  const [selectedCategory, setSelectedCategory] = useState<MonthlyPnLCategory>(MONTHLY_PNL_ALL_CATEGORIES[0]);
  const [unitPrice, setUnitPrice] = useState<string>(String(recipes[0]?.sellingPrice ?? 0));

  const [revenueState, revenueAction] = useActionState(addRevenueEntryAction, { success: false });
  const [expenseState, expenseAction] = useActionState(addExpenseEntryAction, { success: false });

  return (
    <section className="space-y-6">
      <div className="grid grid-cols-1 xl:grid-cols-[330px_minmax(0,1fr)] gap-6">
        <aside className="space-y-4">
          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.5)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Add Revenue</p>
            <form action={revenueAction} className="mt-3 space-y-3">
              <input type="hidden" name="branch_id" value={branchId} />
              <input type="hidden" name="period" value={selectedPeriod} />
              <input type="hidden" name="recipe_id" value={selectedRecipeId} />
              <select
                value={selectedRecipeId}
                onChange={(event) => {
                  const next = event.target.value;
                  setSelectedRecipeId(next);
                  const recipe = recipes.find((r) => r.id === next);
                  if (recipe) setUnitPrice(String(recipe.sellingPrice));
                }}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                {recipes.map((recipe) => (
                  <option key={recipe.id} value={recipe.id}>
                    {recipe.name}
                  </option>
                ))}
              </select>
              <input
                type="date"
                name="sale_date"
                defaultValue={`${selectedPeriod}-01`}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
              />
              <input
                name="quantity"
                type="number"
                min={1}
                defaultValue={1}
                inputMode="numeric"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
              />
              <input
                name="unit_price"
                type="number"
                min={0}
                step="0.01"
                value={unitPrice}
                onChange={(event) => setUnitPrice(event.target.value)}
                inputMode="decimal"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
              />
              <select
                name="channel"
                defaultValue="manual"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                <option value="delivery">Delivery</option>
                <option value="dine_in">Dine-In</option>
                <option value="takeaway">Takeaway</option>
                <option value="manual">Manual</option>
              </select>
              <SubmitButton label="Add Revenue" />
              {revenueState.error ? <p className="text-xs font-semibold text-rose-600">{revenueState.error}</p> : null}
              {revenueState.success ? <p className="text-xs font-semibold text-emerald-600">{revenueState.message}</p> : null}
            </form>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.5)]">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Add Expense</p>
            <form action={expenseAction} className="mt-3 space-y-3">
              <input type="hidden" name="branch_id" value={branchId} />
              <input type="hidden" name="period" value={selectedPeriod} />
              <select
                name="category"
                value={selectedCategory}
                onChange={(event) => setSelectedCategory(event.target.value as MonthlyPnLCategory)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
              >
                {MONTHLY_PNL_ALL_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
              <input
                type="number"
                name="amount"
                min={0}
                step="0.01"
                defaultValue={0}
                inputMode="decimal"
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm font-semibold text-slate-700"
              />
              <SubmitButton label="Add Expense" />
              {expenseState.error ? <p className="text-xs font-semibold text-rose-600">{expenseState.error}</p> : null}
              {expenseState.success ? <p className="text-xs font-semibold text-emerald-600">{expenseState.message}</p> : null}
            </form>
          </div>
        </aside>

        <div className="space-y-6">
          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.55)]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Sales Performance Panel</p>
                <h2 className="mt-1 text-2xl font-black text-[#052e36]">Delivery vs Takeaway Intelligence</h2>
              </div>
              <div className="inline-flex items-center gap-2">
                <Link
                  href={varianceHref}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-700"
                >
                  <TrendingUp className="h-4 w-4" />
                  Variance View
                </Link>
                <Link
                  href={vendorsHref}
                  className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase tracking-[0.18em] text-slate-700"
                >
                  Vendor Ledger
                </Link>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Delivery Sales</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(deliverySales)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Dine-In Sales</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(dineInSales)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Average Ticket</p>
                <p className="mt-1 text-2xl font-black text-slate-900">{formatCurrency(averageTicket)}</p>
              </div>
            </div>

            <div className="mt-5 h-72 rounded-2xl border border-slate-200 bg-slate-50 p-3">
              <ChartContainer config={salesChartConfig} className="h-full w-full">
                <BarChart data={weeklySalesSeries}>
                  <CartesianGrid stroke="#d9e2ec" strokeDasharray="3 3" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: '#475569' }} />
                  <YAxis tickFormatter={(value) => `$${Math.round(Number(value) / 1000)}k`} tick={{ fontSize: 12, fill: '#475569' }} />
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(value)}
                      />
                    }
                  />
                  <Bar dataKey="delivery" fill="var(--color-delivery)" radius={[8, 8, 0, 0]} />
                  <Bar dataKey="takeaway" fill="var(--color-takeaway)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ChartContainer>
            </div>
          </section>

          <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_20px_55px_-36px_rgba(15,23,42,0.55)]">
            <h3 className="text-2xl font-black text-[#052e36]">Advanced P&amp;L Matrix</h3>
            <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[760px]">
                <thead className="bg-[#052e36]">
                  <tr>
                    <th className="px-4 py-3 text-left text-[11px] font-black uppercase tracking-[0.18em] text-white">Stage</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.18em] text-white">Amount</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.18em] text-white">% Sales</th>
                    <th className="px-4 py-3 text-right text-[11px] font-black uppercase tracking-[0.18em] text-white">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {matrixRows.map((row) => (
                    <tr key={row.label} className="border-t border-slate-100 bg-white">
                      <td className="px-4 py-3 text-sm font-black text-slate-800">{row.label}</td>
                      <td className="px-4 py-3 text-right text-sm font-black text-slate-900">{formatCurrency(row.amount)}</td>
                      <td className="px-4 py-3 text-right text-sm font-bold text-slate-700">{row.pct.toFixed(1)}%</td>
                      <td className="px-4 py-3 text-right">
                        <span className={`inline-flex rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] ${toneClasses(row.status.tone)}`}>
                          {row.status.label}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <p className="mt-3 text-xs font-semibold text-slate-500">
              Baseline snapshot: Net Sales {formatCurrency(baseline.netSales)} | COGS {formatCurrency(baseline.cogs)} | Operations {formatCurrency(baseline.operationsCost)} | EBITDA {formatCurrency(baseline.ebitda)}
            </p>
          </section>
        </div>
      </div>
    </section>
  );
}

