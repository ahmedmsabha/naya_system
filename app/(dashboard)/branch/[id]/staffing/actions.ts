"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";

function todayIsoDate(): string {
  return new Date().toISOString().split("T")[0];
}

export async function addStaff(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const employeeCode = String(formData.get("employee_code") ?? "").trim() || null;
  const salaryPeriod = String(formData.get("salary_period") ?? "monthly");
  const baseSalary = Number(formData.get("base_salary") ?? 0) || 0;
  const p1 = Number(formData.get("salary_p1") ?? 0) || 0;
  const p2 = Number(formData.get("salary_p2") ?? 0) || 0;
  const p3 = Number(formData.get("salary_p3") ?? 0) || 0;
  const p4 = Number(formData.get("salary_p4") ?? 0) || 0;
  const performanceRating = Number(formData.get("performance_rating") ?? 0) || 0;
  const adpStatus = String(formData.get("adp_status") ?? "not_connected");

  if (!branchId) return { error: "Missing branch_id" };
  if (!fullName) return { error: "Full name is required" };

  const normalizedPeriod = salaryPeriod.toLowerCase();
  const computedBase =
    normalizedPeriod === "semi_monthly"
      ? p1 + p2
      : normalizedPeriod === "quarterly"
      ? p1 + p2 + p3 + p4
      : baseSalary;

  const { error } = await supabase.from("branch_staff").insert({
    branch_id: branchId,
    full_name: fullName,
    email,
    phone,
    employee_code: employeeCode,
    base_salary: computedBase,
    salary_period: salaryPeriod,
    salary_p1: p1,
    salary_p2: p2,
    salary_p3: p3,
    salary_p4: p4,
    performance_rating: performanceRating,
    adp_status: adpStatus,
    hired_at: todayIsoDate(),
  });

  if (error) return { error: error.message };
  revalidatePath(`/branch/${branchId}/staffing`);
  return { success: true };
}

export async function bulkAddStaff(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const raw = String(formData.get("raw") ?? "");

  if (!branchId) return { error: "Missing branch_id" };
  if (!raw.trim()) return { error: "Paste at least one line" };

  // Format per line:
  // Full Name | email | salary
  // commas also supported: Full Name, email, salary
  const rows = raw
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      const parts = line.includes("|") ? line.split("|") : line.split(",");
      const fullName = (parts[0] ?? "").trim();
      const email = (parts[1] ?? "").trim() || null;
      const baseSalary = Number((parts[2] ?? "").trim() || 0) || 0;
      if (!fullName) return null;
      return {
        branch_id: branchId,
        full_name: fullName,
        email,
        base_salary: baseSalary,
        salary_period: "monthly",
        hired_at: todayIsoDate(),
      };
    })
    .filter(Boolean) as Array<Record<string, unknown>>;

  if (!rows.length) return { error: "No valid lines found" };

  const { error } = await supabase.from("branch_staff").insert(rows);
  if (error) return { error: error.message };

  revalidatePath(`/branch/${branchId}/staffing`);
  return { success: true, inserted: rows.length };
}

export async function deleteStaff(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  if (!branchId || !staffId) return { error: "Missing ids" };

  const { error } = await supabase.from("branch_staff").delete().eq("id", staffId).eq("branch_id", branchId);
  if (error) return { error: error.message };

  revalidatePath(`/branch/${branchId}/staffing`);
  return { success: true };
}

export async function updateStaff(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const staffId = String(formData.get("staff_id") ?? "");
  if (!branchId || !staffId) return { error: "Missing ids" };

  const fullName = String(formData.get("full_name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim() || null;
  const phone = String(formData.get("phone") ?? "").trim() || null;
  const employeeCode = String(formData.get("employee_code") ?? "").trim() || null;
  const salaryPeriod = String(formData.get("salary_period") ?? "monthly");
  const baseSalary = Number(formData.get("base_salary") ?? 0) || 0;
  const p1 = Number(formData.get("salary_p1") ?? 0) || 0;
  const p2 = Number(formData.get("salary_p2") ?? 0) || 0;
  const p3 = Number(formData.get("salary_p3") ?? 0) || 0;
  const p4 = Number(formData.get("salary_p4") ?? 0) || 0;
  const performanceRating = Number(formData.get("performance_rating") ?? 0) || 0;
  const adpStatus = String(formData.get("adp_status") ?? "not_connected");

  if (!fullName) return { error: "Full name is required" };

  const normalizedPeriod = salaryPeriod.toLowerCase();
  const computedBase =
    normalizedPeriod === "semi_monthly"
      ? p1 + p2
      : normalizedPeriod === "quarterly"
      ? p1 + p2 + p3 + p4
      : baseSalary;

  const { error } = await supabase
    .from("branch_staff")
    .update({
      full_name: fullName,
      email,
      phone,
      employee_code: employeeCode,
      base_salary: computedBase,
      salary_period: salaryPeriod,
      salary_p1: p1,
      salary_p2: p2,
      salary_p3: p3,
      salary_p4: p4,
      performance_rating: performanceRating,
      adp_status: adpStatus,
      updated_at: new Date().toISOString(),
    })
    .eq("id", staffId)
    .eq("branch_id", branchId);

  if (error) return { error: error.message };
  revalidatePath(`/branch/${branchId}/staffing`);
  return { success: true };
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

