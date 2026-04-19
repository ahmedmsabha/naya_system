import { z } from "zod";

const entityId = z.string().trim().min(1);
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])(?:-\d{2})?$/);
const nonNegativeNumber = z.coerce.number().min(0);
const status = z.enum(["active", "on-leave", "terminated"]);

function normalizeEmploymentStatus(value: unknown): "active" | "on-leave" | "terminated" {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "active") return "active";
  if (raw === "on-leave" || raw === "on_leave" || raw === "leave") return "on-leave";
  if (raw === "terminated" || raw === "inactive") return "terminated";
  return "active";
}

function normalizeAdpStatus(value: unknown): string {
  const raw = String(value ?? "").trim().toLowerCase();
  if (raw === "connected" || raw === "adp_connected" || raw === "synced") return "connected";
  if (!raw || raw === "not_connected" || raw === "disconnected") return "not_connected";
  return raw;
}

export const addStaffSchema = z.object({
  branch_id: entityId,
  full_name: z.string().trim().min(1),
  email: z.string().trim().email().optional().or(z.literal("")),
  phone: z.string().trim().optional(),
  employee_code: z.string().trim().optional(),
  adp_status: z.preprocess((v) => normalizeAdpStatus(v), z.string().trim().min(1)).optional().default("not_connected"),
  role: z.string().trim().optional().default("crew"),
  shift: z.string().trim().optional().default("full"),
  hours_per_week: nonNegativeNumber.default(40),
  status: z.preprocess((v) => normalizeEmploymentStatus(v), status).optional().default("active"),
  notes: z.string().trim().optional().default(""),
  salary_p1: nonNegativeNumber.optional(),
  salary_p2: nonNegativeNumber.optional(),
  salary: nonNegativeNumber.optional(),
  performance_rating: z.coerce.number().min(0).max(5).default(0),
  selected_period: period.optional(),
  effective_month: period.optional(),
});

export const bulkAddStaffSchema = z.object({
  branch_id: entityId,
  raw: z.string().trim().min(1),
  selected_period: period.optional(),
});

export const deleteStaffSchema = z.object({
  branch_id: entityId,
  staff_id: entityId,
});

export const upsertStaffingSnapshotSchema = z.object({
  branch_id: entityId,
  staff_id: entityId,
  selected_period: period,
  allow_historical: z.enum(["0", "1"]).optional().default("0"),
  role: z.string().trim().optional().default("crew"),
  salary_p1: nonNegativeNumber.default(0),
  salary_p2: nonNegativeNumber.default(0),
  shift: z.string().trim().optional().default("full"),
  hours_per_week: nonNegativeNumber.default(40),
  performance_rating: z.coerce.number().min(0).max(5).default(0),
  status: z.preprocess((v) => normalizeEmploymentStatus(v), status).optional().default("active"),
  notes: z.string().trim().optional().default(""),
});

export const staffIdSchema = z.object({
  branch_id: entityId,
  staff_id: entityId,
});

export const syncPayrollSchema = z.object({
  branch_id: entityId,
});

function formDataToRecord(formData: FormData): Record<string, string> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of formData.entries()) {
    entries.push([key, String(value)]);
  }
  return Object.fromEntries(entries);
}

export function parseStaffingForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): z.infer<T> {
  return schema.parse(formDataToRecord(formData));
}

export function safeParseStaffingForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
){
  return schema.safeParse(formDataToRecord(formData));
}
