import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { AddStaffDialog } from "@/components/staffing/AddStaffDialog";
import { StaffTable, type EmployeeStatic, type StaffingRecord } from "@/components/staffing/StaffTable";
import { syncPayrollAction } from "./actions";

export const dynamic = "force-dynamic";

const CARRY_FORWARD_INCLUDE_TERMINATED = false;

function nowMonthKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function toMonthKey(v: string): string {
  return v.slice(0, 7);
}

export default async function StaffingPage({
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
  const isHistorical = selectedPeriod < nowMonthKey();
  const supabase = await createClient();

  const { data: branch } = await supabase.from("branches").select("name").eq("id", id).single();
  if (!branch) notFound();

  const { data: staffRows } = await supabase
    .from("branch_staff")
    .select("id, full_name, email, phone, employee_code, adp_status")
    .eq("branch_id", id)
    .order("full_name", { ascending: true });

  const employees = (staffRows ?? []) as EmployeeStatic[];

  const { data: historyRows } = await supabase
    .from("branch_staff_compensation_history")
    .select(
      "staff_id, recorded_at, effective_month, role, shift, hours_per_week, employment_status, notes, salary_p1, salary_p2, performance_rating"
    )
    .eq("branch_id", id)
    .lte("effective_month", selectedMonthStart)
    .order("recorded_at", { ascending: true });

  const staffingByPeriod = new Map<string, Map<string, StaffingRecord & { recorded_at: string }>>();
  for (const row of historyRows ?? []) {
    const periodKey = toMonthKey(String(row.effective_month ?? ""));
    if (!periodKey) continue;
    if (!staffingByPeriod.has(periodKey)) staffingByPeriod.set(periodKey, new Map());
    const periodMap = staffingByPeriod.get(periodKey)!;
    const prev = periodMap.get(String(row.staff_id));
    if (!prev || new Date(String(row.recorded_at)).getTime() >= new Date(prev.recorded_at).getTime()) {
      periodMap.set(String(row.staff_id), {
        role: String(row.role ?? "crew"),
        salaryP1: Number(row.salary_p1 ?? 0) || 0,
        salaryP2: Number(row.salary_p2 ?? 0) || 0,
        performanceRating: Number(row.performance_rating ?? 0) || 0,
        shift: String(row.shift ?? "full"),
        hoursPerWeek: Number(row.hours_per_week ?? 40) || 40,
        status: (String(row.employment_status ?? "active") as "active" | "on-leave" | "terminated"),
        notes: String(row.notes ?? ""),
        recorded_at: String(row.recorded_at),
      });
    }
  }

  const availablePeriods = Array.from(staffingByPeriod.keys()).sort();
  const previousPeriod = [...availablePeriods].reverse().find((p) => p < selectedPeriod) ?? null;

  let selectedSnapshot = staffingByPeriod.get(selectedPeriod) ?? null;
  if (!selectedSnapshot) {
    const carry = previousPeriod ? staffingByPeriod.get(previousPeriod) : null;
    selectedSnapshot = new Map<string, StaffingRecord & { recorded_at: string }>();
    if (carry) {
      for (const [staffId, snapshot] of carry.entries()) {
        if (!CARRY_FORWARD_INCLUDE_TERMINATED && snapshot.status === "terminated") continue;
        selectedSnapshot.set(staffId, { ...snapshot });
      }
    }
  }

  const staffCount = employees.length;
  const adpConnected = employees.filter((r) => r.adp_status === "connected").length;
  return (
    <div dir="ltr" className="max-w-7xl">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-3xl font-black text-[#052e36] tracking-tight">Staffing</h1>
          <p className="text-gray-400 text-sm font-bold mt-2">
            {branch.name} - employee information entry and updates
          </p>
          <Link
            href={`/branch/${id}/payroll?period=${selectedPeriod}`}
            className="mt-3 inline-flex items-center gap-2 text-[11px] font-black uppercase tracking-[.2em] text-[#2563eb] hover:text-[#1d4ed8]"
          >
            Open payroll review
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        <AddStaffDialog branchId={id} selectedPeriod={selectedPeriod} />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black text-gray-300 tracking-widest uppercase">ADP</div>
            <div className="mt-2 text-xl font-black text-[#052e36]">{adpConnected}</div>
            <div className="text-[11px] font-bold text-gray-400 mt-1">connected</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#fff7ed] border border-orange-100" />
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black text-gray-300 tracking-widest uppercase">{selectedPeriod}</div>
            <div className="mt-2 text-xl font-black text-[#052e36]">Entry Period</div>
            <div className="text-[11px] font-bold text-gray-400 mt-1">new and edited records apply to this period</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#eaf8f3] border border-emerald-100" />
        </div>

        <div className="bg-white rounded-[2rem] border border-gray-100 p-6 shadow-sm flex items-center justify-between">
          <div>
            <div className="text-[11px] font-black text-gray-300 tracking-widest uppercase">STAFF</div>
            <div className="mt-2 text-xl font-black text-[#052e36]">{staffCount}</div>
            <div className="text-[11px] font-bold text-gray-400 mt-1">active employees</div>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#eef5fe] border border-blue-100" />
        </div>
      </div>

      <div className="bg-white rounded-[2.5rem] border border-gray-100 p-6 shadow-sm mb-8 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="text-sm font-black text-[#052e36]">Payroll sync</div>
          <div className="text-[12px] font-bold text-gray-400 mt-1">
            ADP auto-sync can be enabled later. For now, this is a manual sync trigger.
          </div>
        </div>
        <form action={syncPayrollAction}>
          <input type="hidden" name="branch_id" value={id} />
          <button className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-2xl px-6 py-3 text-sm font-black shadow-lg shadow-blue-200/30 active:scale-[0.99] transition-all">
            Sync now
          </button>
        </form>
      </div>

      <StaffTable
        branchId={id}
        employees={employees}
        selectedPeriod={selectedPeriod}
        isHistorical={isHistorical}
        selectedSnapshot={Object.fromEntries(
          Array.from(selectedSnapshot.entries()).map(([staffId, rec]) => [staffId, { ...rec }])
        ) as Record<string, StaffingRecord>}
      />
    </div>
  );
}
