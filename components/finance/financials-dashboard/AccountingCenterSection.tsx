'use client';

import Link from 'next/link';
import { MonthlyPnLTable } from '@/components/finance/MonthlyPnLTable';
import { useFinancialsDashboard } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';

export function AccountingCenterSection() {
  const {
    branchId,
    selectedPeriod,
    grossSales,
    rows,
    setRows,
    deductions,
    setDeductions,
  } = useFinancialsDashboard();

  const vendorsHref = `/branch/${branchId}/vendors?period=${encodeURIComponent(selectedPeriod)}`;

  return (
    <section className="min-h-[460px] space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h3 className="text-2xl font-bold text-[#052e36]">Accounting Center</h3>
        <div className="inline-flex items-center gap-2">
          <Link
            href="/accountant"
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
        <div className="max-h-[68vh] max-w-full overflow-auto overscroll-contain">
          <MonthlyPnLTable
            branchId={branchId}
            monthPeriod={selectedPeriod}
            totalCollected={grossSales}
            initialRows={rows}
            initialDeductions={deductions}
            onDataChange={(payload) => {
              setRows(payload.rows);
              setDeductions(payload.deductions);
            }}
          />
        </div>
      </article>
    </section>
  );
}
