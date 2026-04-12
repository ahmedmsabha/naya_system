"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Loader2 } from "lucide-react";
import { formatNumberEn } from "@/lib/format/en";

export type PayrollEmployee = {
  id: string;
  full_name: string;
  employee_code: string | null;
  adp_status: string;
};

export type PayrollRecord = {
  salaryP1: number;
  salaryP2: number;
  status: "active" | "on-leave" | "terminated";
};

function fallbackRecord(): PayrollRecord {
  return {
    salaryP1: 0,
    salaryP2: 0,
    status: "active",
  };
}

export function PayrollReviewTable({
  branchId,
  selectedPeriod,
  employees,
  selectedSnapshot,
}: {
  branchId: string;
  selectedPeriod: string;
  employees: PayrollEmployee[];
  selectedSnapshot: Record<string, PayrollRecord>;
}) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [isPeriodPending, startPeriodTransition] = useTransition();

  const filtered = useMemo(() => {
    const needle = q.toLowerCase().trim();
    if (!needle) return employees;
    return employees.filter((r) => {
      const hay = `${r.full_name} ${r.employee_code ?? ""}`.toLowerCase();
      return hay.includes(needle);
    });
  }, [employees, q]);

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden" dir="ltr">
      <div className="p-5 border-b border-gray-50 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Period</label>
          <input
            type="month"
            value={selectedPeriod}
            disabled={isPeriodPending}
            onChange={(e) => {
              const next = e.target.value;
              if (!next) return;
              startPeriodTransition(() => {
                router.push(`/branch/${branchId}/payroll?period=${next}`);
              });
            }}
            className="rounded-2xl border border-gray-100 bg-gray-50/40 px-4 py-3 text-sm font-bold text-[#052e36]"
          />
          {isPeriodPending ? <Loader2 className="w-4 h-4 animate-spin text-[#2563eb]" /> : null}
        </div>

        <div className="relative flex-1 min-w-[260px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search employee..."
            className="w-full rounded-2xl border border-gray-100 bg-gray-50/40 px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
          />
        </div>

        <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
          {filtered.length} in payroll
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] font-black text-gray-400 tracking-widest uppercase">
              <th className="py-4 px-6 text-left">Employee</th>
              <th className="py-4 px-4 text-center">ADP</th>
              <th className="py-4 px-4 text-center">Status</th>
              <th className="py-4 px-4 text-right">P1 (01-15)</th>
              <th className="py-4 px-4 text-right">P2 (16-30)</th>
              <th className="py-4 px-6 text-right">Total Month</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => {
              const effective = selectedSnapshot[r.id] ?? fallbackRecord();
              const total = Number(effective.salaryP1 || 0) + Number(effective.salaryP2 || 0);
              const isConnected = r.adp_status === "connected";
              const statusTone =
                effective.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : effective.status === "on-leave"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700";

              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                  <td className="py-6 px-6">
                    <div className="font-black text-[#052e36] truncate">{r.full_name}</div>
                    <div className="text-[11px] font-bold text-gray-400 mt-1">
                      {r.employee_code ? `ID: ${r.employee_code}` : "—"}
                    </div>
                  </td>

                  <td className="py-6 px-4 text-center">
                    <span
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1 text-[11px] font-black ${
                        isConnected ? "bg-emerald-50 text-emerald-600" : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {isConnected ? <BadgeCheck className="w-4 h-4" /> : null}
                      {isConnected ? "Connected" : "Not connected"}
                    </span>
                  </td>

                  <td className="py-6 px-4 text-center">
                    <span className={`inline-flex rounded-xl px-3 py-1 text-[10px] font-black uppercase ${statusTone}`}>
                      {effective.status}
                    </span>
                  </td>

                  <td className="py-6 px-4 text-right font-black text-[#052e36]">
                    ${formatNumberEn(effective.salaryP1)}
                  </td>
                  <td className="py-6 px-4 text-right font-black text-[#052e36]">
                    ${formatNumberEn(effective.salaryP2)}
                  </td>
                  <td className="py-6 px-6 text-right font-black text-[#052e36]">
                    ${formatNumberEn(total)}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-gray-400 font-bold">
                  No employees match your search
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </div>
  );
}
