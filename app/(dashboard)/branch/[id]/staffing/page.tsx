import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { AddStaffDialog } from "@/components/staffing/AddStaffDialog";
import { StaffTable, type StaffRow } from "@/components/staffing/StaffTable";
import { syncPayrollAction } from "./actions";

export const dynamic = "force-dynamic";

export default async function StaffingPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: branch } = await supabase.from("branches").select("name").eq("id", id).single();
  if (!branch) notFound();

  const { data: staff } = await supabase
    .from("branch_staff")
    .select(
      "id, full_name, email, phone, employee_code, adp_status, base_salary, salary_period, salary_p1, salary_p2, salary_p3, salary_p4, performance_rating"
    )
    .eq("branch_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false });

  const rows = (staff ?? []) as StaffRow[];

  const staffCount = rows.length;
  const monthlyPayroll = rows
    .filter((r) => r.salary_period === "monthly")
    .reduce((sum, r) => sum + Number(r.base_salary || 0), 0);
  const adpConnected = rows.filter((r) => r.adp_status === "connected").length;

  return (
    <div dir="ltr" className="max-w-7xl">
      {/* Header row */}
      <div className="flex items-center justify-between gap-4 flex-wrap mb-8">
        <div>
          <h1 className="text-3xl font-black text-[#052e36] tracking-tight">Staffing</h1>
          <p className="text-gray-400 text-sm font-bold mt-2">
            {branch.name} — employees & payroll overview
          </p>
        </div>

        <AddStaffDialog branchId={id} />
      </div>

      {/* KPI row */}
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
            <div className="text-[11px] font-black text-gray-300 tracking-widest uppercase">PAYROLL</div>
            <div className="mt-2 text-xl font-black text-[#052e36]">
              ${monthlyPayroll.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-[11px] font-bold text-gray-400 mt-1">monthly estimate</div>
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

      {/* Sync banner */}
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

      {/* Table */}
      <StaffTable rows={rows} branchId={id} />
    </div>
  );
}

