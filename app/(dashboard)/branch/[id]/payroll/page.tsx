import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
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
  searchParams: Promise<{ period?: string; half?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const selectedPeriod = /^\d{4}-\d{2}$/.test(String(sp.period ?? "")) ? String(sp.period) : nowMonthKey();
  const selectedHalf = ["all", "p1", "p2"].includes(String(sp.half ?? "")) ? String(sp.half) : "p1";
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

  const monthLabel = new Date(`${selectedPeriod}-01T12:00:00`).toLocaleDateString("en-US", { month: "long" });
  const halfLabel = selectedHalf === "p1" ? "01-15" : selectedHalf === "p2" ? "16-30" : "Full month";

  return (
    <div className="max-w-7xl w-full" dir="ltr">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div className="text-left">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-black text-[#111827] tracking-tight">Salary Payment System</h1>
          <p className="text-gray-500 text-sm font-bold mt-2">
            {monthLabel} payout statement - {halfLabel}
          </p>
        </div>
      </div>

      <PayrollReviewTable
        branchId={id}
        branchName={String(branch.name ?? "").toUpperCase()}
        selectedPeriod={selectedPeriod}
        selectedHalf={selectedHalf as "all" | "p1" | "p2"}
        periodLabel={`${monthLabel} - ${halfLabel}`}
        employees={employees}
        selectedSnapshot={Object.fromEntries(
          Array.from(selectedSnapshot.entries()).map(([staffId, rec]) => [staffId, { ...rec }])
        ) as Record<string, PayrollRecord>}
      />
    </div>
  );
}
