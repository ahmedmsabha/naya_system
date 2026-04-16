import { z } from "zod";

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const nonNegativeNumber = z.coerce.number().min(0);

export const addIngredientSchema = z.object({
  branch_id: uuid,
  name: z.string().trim().min(1),
  unit: z.string().trim().min(1).default("UNIT"),
  cost_per_unit: nonNegativeNumber.default(0),
});

export const updateQuantitySchema = z.object({
  inventory_id: uuid,
  branch_id: uuid,
  delta: z.coerce.number().int(),
});

export const setQuantitySchema = z.object({
  inventory_id: uuid,
  branch_id: uuid,
  quantity: nonNegativeNumber.default(0),
});

export const deleteInventoryItemSchema = z.object({
  inventory_id: uuid,
  branch_id: uuid,
});

export const distributionSchema = z.object({
  branch_id: uuid,
  ingredient_id: uuid,
  date: isoDate,
  quantity: nonNegativeNumber.default(0),
});

export const resetDistributionsSchema = z.object({
  branch_id: uuid,
  week_start: isoDate,
  week_end: isoDate,
});

export const deleteArchivedInvoiceSchema = z.object({
  invoice_id: uuid,
  branch_id: uuid,
});

export const upsertWeeklyInvoiceSchema = z.object({
  branch_id: uuid,
  status: z.string().trim().optional().default("pending"),
  force_archived: z.enum(["true", "false"]).optional().default("false"),
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

export function safeParseWarehouseForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
){
  return schema.safeParse(formDataToRecord(formData));
}
