'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Download,
  Filter,
  Loader2,
  Search,
} from 'lucide-react';
import { formatNumberEn } from '@/lib/format/en';
import { generatePayrollStatementPdf } from '@/components/payroll/payroll-statement-pdf';

export type PayrollEmployee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  adp_status: string;
};

export type PayrollRecord = {
  salaryP1: number;
  salaryP2: number;
  status: 'active' | 'on-leave' | 'terminated';
};

function fallbackRecord(): PayrollRecord {
  return {
    salaryP1: 0,
    salaryP2: 0,
    status: 'active',
  };
}

export function PayrollReviewTable({
  branchId,
  branchName,
  selectedPeriod,
  selectedHalf,
  periodLabel,
  periodTotals,
  employees,
  selectedSnapshot,
}: {
  branchId: string;
  branchName: string;
  selectedPeriod: string;
  selectedHalf: 'all' | 'p1' | 'p2';
  periodLabel: string;
  periodTotals: { p1: number; p2: number };
  employees: PayrollEmployee[];
  selectedSnapshot: Record<string, PayrollRecord>;
}) {
  const router = useRouter();
  const [q, setQ] = useState('');
  const [isNavigationPending, startNavigationTransition] =
    useTransition();
  const [showUnpaidOnly, setShowUnpaidOnly] =
    useState(false);
  const [paidById, setPaidById] = useState<
    Record<string, boolean>
  >({});
  const [amountById, setAmountById] = useState<
    Record<string, string>
  >({});

  const periodDate = useMemo(
    () => new Date(`${selectedPeriod}-01T12:00:00`),
    [selectedPeriod],
  );
  const monthLabel = useMemo(
    () =>
      periodDate.toLocaleDateString('en-US', {
        month: 'long',
      }),
    [periodDate],
  );

  const changePeriod = (next: string) => {
    startNavigationTransition(() => {
      router.push(
        `/branch/${branchId}/payroll?period=${next}&half=${selectedHalf}`,
      );
    });
  };

  const onSelectHalf = (half: 'all' | 'p1' | 'p2') => {
    if (half === selectedHalf) return;
    startNavigationTransition(() => {
      router.push(
        `/branch/${branchId}/payroll?period=${selectedPeriod}&half=${half}`,
      );
    });
  };

  const rows = useMemo(() => {
    const needle = q.toLowerCase().trim();
    return employees
      .map((employee) => {
        const rec =
          selectedSnapshot[employee.id] ?? fallbackRecord();
        const dueAmount =
          selectedHalf === 'p1'
            ? rec.salaryP1
            : selectedHalf === 'p2'
              ? rec.salaryP2
              : rec.salaryP1 + rec.salaryP2;
        return { employee, rec, dueAmount };
      })
      .filter(({ employee, dueAmount }) => {
        const matchesSearch = needle
          ? `${employee.full_name} ${employee.employee_code ?? ''}`
              .toLowerCase()
              .includes(needle)
          : true;
        const isPaid = Boolean(paidById[employee.id]);
        const matchesPaymentFilter = showUnpaidOnly
          ? !isPaid
          : true;
        return (
          matchesSearch &&
          matchesPaymentFilter &&
          dueAmount >= 0
        );
      });
  }, [
    employees,
    paidById,
    q,
    selectedHalf,
    selectedSnapshot,
    showUnpaidOnly,
  ]);

  const paidCount = rows.filter(
    (r) => paidById[r.employee.id],
  ).length;
  const targetCount = rows.length;
  const totalPayroll =
    selectedHalf === 'p1'
      ? periodTotals.p1
      : selectedHalf === 'p2'
        ? periodTotals.p2
        : periodTotals.p1 + periodTotals.p2;
  const paidSoFar = rows.reduce((sum, row) => {
    const isPaid = Boolean(paidById[row.employee.id]);
    if (!isPaid) return sum;
    const amount = Number(
      amountById[row.employee.id] ?? row.dueAmount,
    );
    return sum + (Number.isFinite(amount) ? amount : 0);
  }, 0);
  const remaining = Math.max(0, totalPayroll - paidSoFar);

  const onDownloadPayrollPdf = () => {
    const pdfRows = rows.map(({ employee, rec, dueAmount }) => {
      const isPaid = Boolean(paidById[employee.id]);
      const paidAmountRaw = Number(
        amountById[employee.id] ?? dueAmount,
      );
      const paidAmount = Number.isFinite(paidAmountRaw)
        ? paidAmountRaw
        : 0;

      const status = rec.status === 'terminated'
        ? 'Terminated'
        : isPaid
          ? 'Paid'
          : 'Unpaid';

      return {
        employee: employee.full_name,
        baseSalary: dueAmount,
        paidAmount,
        status,
      };
    });

    generatePayrollStatementPdf({
      branchName,
      periodLabel,
      rows: pdfRows,
      totalPayroll,
      paidSoFar,
      remaining,
    });
  };

  return (
    <div className="space-y-5 print:space-y-3" dir="ltr">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-1 print:grid-cols-3 print:gap-3">
        <div className="bg-[#4f46e5] rounded-[2rem] p-6 shadow-lg shadow-indigo-200/40 text-white print:shadow-none print:border print:border-indigo-200">
          <div className="text-[11px] font-black text-indigo-100">
            Total Payroll
          </div>
          <div className="mt-2 text-4xl font-black">
            $
            {formatNumberEn(totalPayroll, {
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
        <div className="bg-white rounded-[2rem] border border-emerald-100 p-6 shadow-sm print:shadow-none">
          <div className="text-[11px] font-black text-gray-400">
            Paid So Far
          </div>
          <div className="mt-2 text-4xl font-black text-[#111827]">
            $
            {formatNumberEn(paidSoFar, {
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
        <div className="bg-white rounded-[2rem] border border-amber-100 p-6 shadow-sm print:shadow-none">
          <div className="text-[11px] font-black text-gray-400">
            Remaining
          </div>
          <div className="mt-2 text-4xl font-black text-[#111827]">
            $
            {formatNumberEn(remaining, {
              maximumFractionDigits: 0,
            })}
          </div>
        </div>
      </div>

      <div className="hidden print:block border border-gray-200 rounded-2xl px-4 py-3">
        <div className="text-lg font-black text-[#111827]">
          Salary Payment Statement
        </div>
        <div className="text-sm font-bold text-gray-500 mt-1">
          {branchName} - {periodLabel}
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <div className="rounded-full border border-gray-100 bg-white px-5 py-4 w-full sm:w-auto min-w-0 sm:min-w-[240px] flex items-center justify-between gap-6">
          <button
            type="button"
            disabled={isNavigationPending}
            onClick={() => {
              const d = new Date(
                `${selectedPeriod}-01T12:00:00`,
              );
              d.setMonth(d.getMonth() - 1);
              changePeriod(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
              );
            }}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <div className="font-black text-[#111827] text-xl leading-none">
            {monthLabel}
          </div>
          <button
            type="button"
            disabled={isNavigationPending}
            onClick={() => {
              const d = new Date(
                `${selectedPeriod}-01T12:00:00`,
              );
              d.setMonth(d.getMonth() + 1);
              changePeriod(
                `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
              );
            }}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        <div className="text-left w-full sm:w-auto">
          <div className="text-[#4f46e5] font-black text-sm">
            Salary Payment System
          </div>
          <div className="text-gray-400 text-xs font-bold mt-1 inline-flex items-center gap-1">
            <CalendarDays className="w-3.5 h-3.5" />
            {periodLabel}
          </div>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm overflow-hidden print:rounded-xl print:shadow-none relative">
        {isNavigationPending ? (
          <div className="absolute inset-x-0 top-0 z-10 h-1 bg-[#4f46e5]/20 overflow-hidden">
            <div className="h-full w-1/3 bg-[#4f46e5] animate-pulse" />
          </div>
        ) : null}
        <div className="p-4 md:p-5 border-b border-gray-50 flex items-center justify-between gap-4 flex-wrap print:hidden">
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={isNavigationPending}
              onClick={() => onSelectHalf('all')}
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                selectedHalf === 'all'
                  ? 'bg-[#eef2ff] text-[#4338ca]'
                  : 'bg-[#f3f4f6] text-gray-500'
              } disabled:opacity-60`}
            >
              All periods
            </button>
            <button
              type="button"
              disabled={isNavigationPending}
              onClick={() => onSelectHalf('p1')}
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                selectedHalf === 'p1'
                  ? 'bg-[#eef2ff] text-[#4338ca]'
                  : 'bg-[#f3f4f6] text-gray-500'
              } disabled:opacity-60`}
            >
              01-15
            </button>
            <button
              type="button"
              disabled={isNavigationPending}
              onClick={() => onSelectHalf('p2')}
              className={`rounded-xl px-4 py-2 text-sm font-black ${
                selectedHalf === 'p2'
                  ? 'bg-[#eef2ff] text-[#4338ca]'
                  : 'bg-[#f3f4f6] text-gray-500'
              } disabled:opacity-60`}
            >
              16-30
            </button>
          </div>

          <div className="flex items-center gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => setShowUnpaidOnly((v) => !v)}
              className="rounded-xl border border-gray-100 bg-white px-4 py-2 text-xs font-black text-gray-600 inline-flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showUnpaidOnly ? 'Unpaid only' : 'All'}
            </button>

            <div className="relative w-full min-w-0 sm:min-w-[250px]">
              <Search className="w-4 h-4 text-gray-300 absolute left-4 top-1/2 -translate-y-1/2" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Search employee..."
                className="w-full rounded-xl border border-gray-100 bg-white pl-10 pr-4 py-2.5 text-sm font-medium text-left focus:outline-none focus:border-[#4f46e5] focus:ring-4 focus:ring-[#4f46e5]/10"
              />
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px] md:min-w-[900px] print:min-w-0">
            <thead>
              <tr className="border-b border-gray-100 text-[11px] font-black text-gray-400">
                <th className="py-4 px-6 text-left">
                  Employee
                </th>
                <th className="py-4 px-4 text-center">
                  Payout Status
                </th>
                <th className="py-4 px-4 text-center">
                  Base Salary
                </th>
                <th className="py-4 px-4 text-center text-[#4f46e5]">
                  Paid Amount ($)
                </th>
                <th className="py-4 px-4 text-center">
                  Notes
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ employee, rec, dueAmount }) => {
                const isPaid = Boolean(
                  paidById[employee.id],
                );
                const inputValue =
                  amountById[employee.id] ?? '0.00';
                const avatarLetter =
                  employee.full_name
                    ?.trim()
                    .charAt(0)
                    .toUpperCase() || 'S';
                return (
                  <tr
                    key={employee.id}
                    className={`border-b border-gray-50 ${isPaid ? 'bg-emerald-50/40' : ''}`}
                  >
                    <td className="py-6 px-6">
                      <div className="flex items-center justify-start gap-3">
                        <div className="text-left">
                          <div className="font-black text-[#111827]">
                            {employee.full_name}
                          </div>
                          <div className="text-[11px] font-bold text-gray-400">
                            {branchName}
                          </div>
                        </div>
                        <div
                          className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black ${
                            isPaid
                              ? 'bg-[#4f46e5] text-white'
                              : 'bg-[#f3f4f6] text-[#94a3b8]'
                          }`}
                        >
                          {avatarLetter}
                        </div>
                      </div>
                    </td>

                    <td className="py-6 px-4 text-center">
                      <label className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-3 py-2 text-[11px] text-gray-500 font-bold cursor-pointer">
                        <input
                          type="checkbox"
                          checked={isPaid}
                          onChange={(e) => {
                            const checked =
                              e.target.checked;
                            setPaidById((prev) => ({
                              ...prev,
                              [employee.id]: checked,
                            }));
                            if (
                              checked &&
                              (!amountById[employee.id] ||
                                Number(
                                  amountById[employee.id],
                                ) === 0)
                            ) {
                              setAmountById((prev) => ({
                                ...prev,
                                [employee.id]: String(
                                  dueAmount.toFixed(2),
                                ),
                              }));
                            }
                          }}
                          className="w-4 h-4 rounded border-gray-300 accent-[#4f46e5]"
                        />
                        {isPaid ? 'Paid' : 'Mark paid'}
                      </label>
                    </td>

                    <td className="py-6 px-4 text-center font-black text-[#64748b]">
                      $
                      {formatNumberEn(dueAmount, {
                        maximumFractionDigits: 0,
                      })}
                    </td>

                    <td className="py-6 px-4 text-center">
                      <input
                        value={inputValue}
                        onChange={(e) =>
                          setAmountById((prev) => ({
                            ...prev,
                            [employee.id]: e.target.value,
                          }))
                        }
                        className="w-24 rounded-xl border border-gray-100 bg-white px-3 py-2 text-center font-black text-gray-500 focus:outline-none focus:border-[#4f46e5]"
                      />
                    </td>

                    <td className="py-6 px-4 text-center text-gray-400 text-xs font-bold">
                      {rec.status === 'terminated'
                        ? 'Terminated'
                        : isPaid
                          ? 'Recorded'
                          : '-'}
                    </td>
                  </tr>
                );
              })}
              {rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="py-16 text-center text-gray-400 font-bold"
                  >
                    No employees match current filters
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 flex-wrap print:hidden">
        <button
          type="button"
          onClick={onDownloadPayrollPdf}
          className="inline-flex items-center gap-2 bg-[#03153d] hover:bg-[#081f55] text-white rounded-full px-5 sm:px-8 py-3 text-base sm:text-xl font-black shadow-lg w-full sm:w-auto justify-center"
        >
          <Download className="w-5 h-5" />
          Download Final Statement (PDF)
        </button>

        <div className="bg-white rounded-full px-6 py-3 text-sm font-bold text-gray-400 inline-flex items-center gap-2 border border-gray-100">
          {targetCount === 0 ? (
            'No payments recorded'
          ) : (
            <>
              <Check className="w-4 h-4 text-[#4f46e5]" />
              {paidCount} payments recorded out of{' '}
              {targetCount}
            </>
          )}
        </div>
      </div>
      {isNavigationPending ? (
        <div className="fixed bottom-6 left-6 bg-white border border-gray-100 rounded-2xl px-4 py-2 shadow-md text-xs font-bold text-gray-500 inline-flex items-center gap-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          Loading payroll data...
        </div>
      ) : null}
    </div>
  );
}
