"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import {
  syncLaborExpenseForPeriod,
} from "@/lib/finance/transaction-sync";

function monthKeyNow(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function periodToMonthStart(raw: string | null | undefined): string {
  const input = String(raw ?? "").trim();
  const ym = input && /^\d{4}-\d{2}/.test(input) ? input.slice(0, 7) : monthKeyNow();
  return `${ym}-01`;
}

function monthKeyFromDate(dateLike: string): string {
  return dateLike.slice(0, 7);
}

type SnapshotPayload = {
  staff_id: string;
  branch_id: string;
  effective_month: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  employee_code: string | null;
  adp_status: string;
  role: string;
  shift: string;
  hours_per_week: number;
  employment_status: "active" | "on-leave" | "terminated";
  notes: string;
  salary_p1: number;
  salary_p2: number;
  performance_rating: number;
};

async function insertSnapshot(
  supabase: Awaited<ReturnType<typeof createClient>>,
  row: SnapshotPayload
) {
  const { error } = await supabase.from("branch_staff_compensation_history").insert({
    staff_id: row.staff_id,
    branch_id: row.branch_id,
    effective_month: row.effective_month,
    full_name: row.full_name,
    email: row.email,
    phone: row.phone,
    employee_code: row.employee_code,
    adp_status: row.adp_status,
    role: row.role,
    shift: row.shift,
    hours_per_week: row.hours_per_week,
    employment_status: row.employment_status,
    notes: row.notes,
    salary_period: "semi_monthly",
    base_salary: row.salary_p1 + row.salary_p2,
    salary_p1: row.salary_p1,
    salary_p2: row.salary_p2,
    salary_p3: 0,
    salary_p4: 0,
    performance_rating: row.performance_rating,
  });
  if (error) return { error: error.message };
  return { success: true };
}

export async function addStaff(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const employeeCode = String(formData.get("employee_code") ?? "").trim() || null;
  const adpStatus = String(formData.get("adp_status") ?? "not_connected");

  const role = String(formData.get("role") ?? "crew").trim() || "crew";
  const shift = String(formData.get("shift") ?? "full").trim() || "full";
  const hoursPerWeek = Math.max(0, Number(formData.get("hours_per_week") ?? 40) || 40);
  const employmentStatus = String(formData.get("status") ?? "active") as
    | "active"
    | "on-leave"
    | "terminated";
  const notes = String(formData.get("notes") ?? "").trim();
  const salaryP1 = Math.max(0, Number(formData.get("salary_p1") ?? formData.get("salary") ?? 0) || 0);
  const salaryP2 = Math.max(0, Number(formData.get("salary_p2") ?? formData.get("salary") ?? 0) || 0);
  const performanceRating = Math.max(0, Math.min(5, Number(formData.get("performance_rating") ?? 0) || 0));
  const effectiveMonth = periodToMonthStart(String(formData.get("selected_period") ?? formData.get("effective_month") ?? ""));

  if (!branchId) return { error: "Missing branch id" };
  if (!fullName) return { error: "Full name is required" };

  const { data: created, error: createError } = await supabase
    .from("branch_staff")
    .insert({
      branch_id: branchId,
      full_name: fullName,
      email,
      phone,
      employee_code: employeeCode,
      adp_status: adpStatus,
      base_salary: salaryP1 + salaryP2,
      salary_period: "semi_monthly",
      status: employmentStatus === "terminated" ? "inactive" : "active",
      hired_at: new Date().toISOString().slice(0, 10),
    })
    .select("id")
    .single();

  if (createError || !created) return { error: createError?.message ?? "Failed to create employee" };

  const insertRes = await insertSnapshot(supabase, {
    staff_id: created.id,
    branch_id: branchId,
    effective_month: effectiveMonth,
    full_name: fullName,
    email,
    phone,
    employee_code: employeeCode,
    adp_status: adpStatus,
    role,
    shift,
    hours_per_week: hoursPerWeek,
    employment_status: employmentStatus,
    notes,
    salary_p1: salaryP1,
    salary_p2: salaryP2,
    performance_rating: performanceRating,
  });
  if ("error" in insertRes) return insertRes;

  await syncLaborExpenseForPeriod(supabase, branchId, monthKeyFromDate(effectiveMonth));

  revalidatePath(`/branch/${branchId}/staffing`);
  revalidatePath(`/branch/${branchId}/financials`);
  return { success: true };
}

export async function bulkAddStaff(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const raw = String(formData.get("raw") ?? "");
  const selectedPeriod = periodToMonthStart(String(formData.get("selected_period") ?? ""));

  if (!branchId) return { error: "Missing branch id" };
  if (!raw.trim()) return { error: "Paste at least one line" };

  const lines = raw.split("\n").map((x) => x.trim()).filter(Boolean);
  let inserted = 0;

  for (const line of lines) {
    const parts = line.includes("|") ? line.split("|") : line.split(",");
    const fullName = String(parts[0] ?? "").trim();
    if (!fullName) continue;
    const email = String(parts[1] ?? "").trim() || null;
    const salaryHalf = Math.max(0, Number(String(parts[2] ?? "0").trim()) || 0);

    const { data: created, error: createError } = await supabase
      .from("branch_staff")
      .insert({
        branch_id: branchId,
        full_name: fullName,
        email,
        base_salary: salaryHalf * 2,
        salary_period: "semi_monthly",
        status: "active",
        hired_at: new Date().toISOString().slice(0, 10),
      })
      .select("id")
      .single();
    if (createError || !created) continue;

    const snapshotRes = await insertSnapshot(supabase, {
      staff_id: created.id,
      branch_id: branchId,
      effective_month: selectedPeriod,
      full_name: fullName,
      email,
      phone: null,
      employee_code: null,
      adp_status: "not_connected",
      role: "crew",
      shift: "full",
      hours_per_week: 40,
      employment_status: "active",
      notes: "",
      salary_p1: salaryHalf,
      salary_p2: salaryHalf,
      performance_rating: 0,
    });
    if ("error" in snapshotRes) continue;
    inserted += 1;
  }

  await syncLaborExpenseForPeriod(supabase, branchId, monthKeyFromDate(selectedPeriod));

  revalidatePath(`/branch/${branchId}/staffing`);
  revalidatePath(`/branch/${branchId}/financials`);
  return { success: true, inserted };
}

export async function deleteStaff(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  if (!branchId || !staffId) return { error: "Missing ids" };

  const { error } = await supabase.from("branch_staff").delete().eq("id", staffId).eq("branch_id", branchId);
  if (error) return { error: error.message };

  await syncLaborExpenseForPeriod(supabase, branchId, monthKeyNow());

  revalidatePath(`/branch/${branchId}/staffing`);
  revalidatePath(`/branch/${branchId}/financials`);
  return { success: true };
}

export async function upsertStaffingSnapshot(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  const selectedPeriod = String(formData.get("selected_period") ?? "");
  const allowHistorical = String(formData.get("allow_historical") ?? "") === "1";

  if (!branchId || !staffId || !selectedPeriod) {
    return { error: "Missing branch, staff, or period" };
  }

  const targetMonth = selectedPeriod.slice(0, 7);
  if (!allowHistorical && targetMonth < monthKeyNow()) {
    return { error: "Historical period edit requires confirmation" };
  }

  const role = String(formData.get("role") ?? "crew").trim() || "crew";
  const salaryP1 = Math.max(0, Number(formData.get("salary_p1") ?? 0) || 0);
  const salaryP2 = Math.max(0, Number(formData.get("salary_p2") ?? 0) || 0);
  const shift = String(formData.get("shift") ?? "full").trim() || "full";
  const hoursPerWeek = Math.max(0, Number(formData.get("hours_per_week") ?? 40) || 40);
  const performanceRating = Math.max(0, Math.min(5, Number(formData.get("performance_rating") ?? 0) || 0));
  const employmentStatus = String(formData.get("status") ?? "active") as
    | "active"
    | "on-leave"
    | "terminated";
  const notes = String(formData.get("notes") ?? "").trim();

  const { data: staff, error: staffError } = await supabase
    .from("branch_staff")
    .select("id, full_name, email, phone, employee_code, adp_status")
    .eq("id", staffId)
    .eq("branch_id", branchId)
    .single();
  if (staffError || !staff) return { error: "Employee not found" };

  const insertRes = await insertSnapshot(supabase, {
    staff_id: staffId,
    branch_id: branchId,
    effective_month: periodToMonthStart(selectedPeriod),
    full_name: staff.full_name,
    email: staff.email,
    phone: staff.phone,
    employee_code: staff.employee_code,
    adp_status: staff.adp_status,
    role,
    shift,
    hours_per_week: hoursPerWeek,
    employment_status: employmentStatus,
    notes,
    salary_p1: salaryP1,
    salary_p2: salaryP2,
    performance_rating: performanceRating,
  });
  if ("error" in insertRes) return insertRes;

  await syncLaborExpenseForPeriod(
    supabase,
    branchId,
    monthKeyFromDate(periodToMonthStart(selectedPeriod)),
  );

  revalidatePath(`/branch/${branchId}/staffing`);
  revalidatePath(`/branch/${branchId}/financials`);
  return { success: true, period: monthKeyFromDate(periodToMonthStart(selectedPeriod)) };
}

export async function toggleStaffAdpStatus(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  if (!branchId || !staffId) return { error: "Missing ids" };

  const { data: current, error: fetchError } = await supabase
    .from("branch_staff")
    .select("adp_status")
    .eq("id", staffId)
    .eq("branch_id", branchId)
    .single();
  if (fetchError || !current) return { error: "Staff not found" };

  const next = String(current.adp_status ?? "") === "connected" ? "not_connected" : "connected";
  const { error } = await supabase
    .from("branch_staff")
    .update({ adp_status: next, updated_at: new Date().toISOString() })
    .eq("id", staffId)
    .eq("branch_id", branchId);
  if (error) return { error: error.message };

  revalidatePath(`/branch/${branchId}/staffing`);
  return { success: true, adp_status: next };
}

export async function syncPayroll(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  if (!branchId) return { error: "Missing branch_id" };

  // Placeholder: log a sync attempt. (Later: call ADP integration.)
  const { error } = await supabase.from("branch_payroll_syncs").insert({
    branch_id: branchId,
    provider: "adp",
    status: "success",
    message: "Manual sync triggered",
  });
  if (error) return { error: error.message };

  revalidatePath(`/branch/${branchId}/staffing`);
  return { success: true };
}

// Server Action intended for <form action={...}> usage
export async function syncPayrollAction(formData: FormData): Promise<void> {
  await syncPayroll(formData);
}

