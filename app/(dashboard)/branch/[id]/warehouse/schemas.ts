import { z } from "zod";

const entityId = z.string().trim().min(1);

/** Accepts `YYYY-MM-DD` or datetime strings; normalizes to calendar date. */
const isoDate = z.preprocess((v) => {
  const s = String(v ?? "").trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return s;
}, z.string().regex(/^\d{4}-\d{2}-\d{2}$/));

const nonNegativeNumber = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().min(0),
);

const intCoerced = z.preprocess(
  (v) => (v === "" || v === null || v === undefined ? 0 : v),
  z.coerce.number().int(),
);

const boolString = z.preprocess((v) => {
  if (v === "" || v === null || v === undefined) return "false";
  const s = String(v).trim().toLowerCase();
  if (s === "1" || s === "yes" || s === "on" || s === "true") return "true";
  if (s === "0" || s === "no" || s === "off" || s === "false") return "false";
  return s === "true" ? "true" : "false";
}, z.enum(["true", "false"]));

export const addIngredientSchema = z.object({
  branch_id: entityId,
  name: z.string().trim().min(1),
  unit: z.preprocess(
    (v) => (typeof v === "string" && !v.trim() ? undefined : v),
    z.string().trim().min(1).default("UNIT"),
  ),
  cost_per_unit: nonNegativeNumber.default(0),
});

export const updateQuantitySchema = z.object({
  inventory_id: entityId,
  branch_id: entityId,
  delta: intCoerced,
});

export const setQuantitySchema = z.object({
  inventory_id: entityId,
  branch_id: entityId,
  quantity: nonNegativeNumber.default(0),
});

export const deleteInventoryItemSchema = z.object({
  inventory_id: entityId,
  branch_id: entityId,
});

export const distributionSchema = z.object({
  branch_id: entityId,
  ingredient_id: entityId,
  date: isoDate,
  quantity: nonNegativeNumber.default(0),
});

export const resetDistributionsSchema = z.object({
  branch_id: entityId,
  week_start: isoDate,
  week_end: isoDate,
});

export const deleteArchivedInvoiceSchema = z.object({
  invoice_id: entityId,
  branch_id: entityId,
});

export const upsertWeeklyInvoiceSchema = z.object({
  branch_id: entityId,
  status: z.string().trim().optional().default("pending"),
  force_archived: boolString.optional().default("false"),
  anchor_date: z.string().trim().optional(),
  purchase_date: z.string().trim().optional(),
  date: z.string().trim().optional(),
});

function formDataToRecord(formData: FormData): Record<string, string> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of formData.entries()) {
    entries.push([key, String(value)]);
  }
  return Object.fromEntries(entries);
}

export function parseWarehouseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): z.infer<T> {
  return schema.parse(formDataToRecord(formData));
}

export function safeParseWarehouseForm<T extends z.ZodTypeAny>(schema: T, formData: FormData) {
  return schema.safeParse(formDataToRecord(formData));
}
