import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { formatNumberEn } from "@/lib/format/en";
import { PayrollReviewTable, type PayrollEmployee, type PayrollRecord } from "@/components/payroll/PayrollReviewTable";

export const dynamic = "force-dynamic";

const CARRY_FORWARD_INCLUDE_TERMINATED = false;

function nowMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthKey(v: string): string {
  return v.slice(0, 7);
}

export default async function PayrollPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const selectedPeriod = /^\d{4}-\d{2}$/.test(String(sp.period ?? "")) ? String(sp.period) : nowMonthKey();
  const selectedMonthStart = `${selectedPeriod}-01`;
  const supabase = await createClient();

  const { data: branch } = await supabase.from("branches").select("name").eq("id", id).single();
  if (!branch) notFound();

  const { data: staffRows } = await supabase
    .from("branch_staff")
    .select("id, full_name, employee_code, adp_status")
    .eq("branch_id", id)
    .order("full_name", { ascending: true });
  const employees = (staffRows ?? []) as PayrollEmployee[];

  const { data: historyRows } = await supabase
    .from("branch_staff_compensation_history")
    .select("staff_id, recorded_at, effective_month, salary_p1, salary_p2, employment_status")
    .eq("branch_id", id)
    .lte("effective_month", selectedMonthStart)
    .order("recorded_at", { ascending: true });

  const payrollByPeriod = new Map<string, Map<string, PayrollRecord & { recorded_at: string }>>();
  for (const row of historyRows ?? []) {
    const periodKey = toMonthKey(String(row.effective_month ?? ""));
    if (!periodKey) continue;
    if (!payrollByPeriod.has(periodKey)) payrollByPeriod.set(periodKey, new Map());
    const periodMap = payrollByPeriod.get(periodKey)!;
    const prev = periodMap.get(String(row.staff_id));
    if (!prev || new Date(String(row.recorded_at)).getTime() >= new Date(prev.recorded_at).getTime()) {
      periodMap.set(String(row.staff_id), {
        salaryP1: Number(row.salary_p1 ?? 0) || 0,
        salaryP2: Number(row.salary_p2 ?? 0) || 0,
        status: (String(row.employment_status ?? "active") as "active" | "on-leave" | "terminated"),
        recorded_at: String(row.recorded_at),
      });
    }
  }

  const availablePeriods = Array.from(payrollByPeriod.keys()).sort();
  const previousPeriod = [...availablePeriods].reverse().find((p) => p < selectedPeriod) ?? null;

  let selectedSnapshot = payrollByPeriod.get(selectedPeriod) ?? null;
  if (!selectedSnapshot) {
    const carry = previousPeriod ? payrollByPeriod.get(previousPeriod) : null;
    selectedSnapshot = new Map<string, PayrollRecord & { recorded_at: string }>();
    if (carry) {
      for (const [staffId, snapshot] of carry.entries()) {
        if (!CARRY_FORWARD_INCLUDE_TERMINATED && snapshot.status === "terminated") continue;
        selectedSnapshot.set(staffId, { ...snapshot });
      }
    }
  }

  const totals = Array.from(selectedSnapshot.values()).reduce(
    (acc, row) => {
      acc.p1 += Number(row.salaryP1 || 0);
      acc.p2 += Number(row.salaryP2 || 0);
      return acc;
    },
    { p1: 0, p2: 0 }
  );
  const totalMonth = totals.p1 + totals.p2;

  return (
    <div className="max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <Link
            href={`/branch/${id}/staffing`}
            className="inline-flex items-center gap-2 text-[11px] font-black tracking-[.2em] text-[#a48443]/60 hover:text-[#a48443] transition-all uppercase"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Staffing
          </Link>
          <h1 className="text-3xl font-black text-[#052e36] tracking-tight mt-4">Payroll Review</h1>
          <p className="text-gray-400 text-sm font-bold mt-2">
            {branch.name} - salary checking view by period
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
          <div className="text-[11px] font-black text-gray-300 tracking-widest uppercase">P1 (01-15)</div>
          <div className="mt-2 text-2xl font-black text-[#052e36]">
            ${formatNumberEn(totals.p1, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm">
          <div className="text-[11px] font-black text-gray-300 tracking-widest uppercase">P2 (16-30)</div>
          <div className="mt-2 text-2xl font-black text-[#052e36]">
            ${formatNumberEn(totals.p2, { maximumFractionDigits: 0 })}
          </div>
        </div>
        <div className="bg-[#2563eb] rounded-[2rem] p-6 shadow-lg shadow-blue-200/30">
          <div className="text-[11px] font-black text-blue-100 tracking-widest uppercase">Total month</div>
          <div className="mt-2 text-2xl font-black text-white">
            ${formatNumberEn(totalMonth, { maximumFractionDigits: 0 })}
          </div>
        </div>
      </div>

      <PayrollReviewTable
        branchId={id}
        selectedPeriod={selectedPeriod}
        employees={employees}
        selectedSnapshot={Object.fromEntries(
          Array.from(selectedSnapshot.entries()).map(([staffId, rec]) => [staffId, { ...rec }])
        ) as Record<string, PayrollRecord>}
      />
    </div>
  );
}
