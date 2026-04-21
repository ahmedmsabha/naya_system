import { z } from "zod";
import { MONTHLY_PNL_ALL_CATEGORIES } from "@/lib/finance/monthly-pnl";

const entityId = z.string().trim().min(1);
const period = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/);
const nonNegativeNumber = z.coerce.number().min(0);

export const supplierFormSchema = z.object({
  branch_id: entityId,
  vendor_name: z.string().trim().optional().default(""),
  vendor_names: z.string().trim().optional().default("[]"),
});

export const deleteSupplierFormSchema = z.object({
  branch_id: entityId,
  supplier_id: entityId,
});

export const upsertExpenseSchema = z.object({
  branchId: entityId,
  monthPeriod: period,
  category: z.enum(MONTHLY_PNL_ALL_CATEGORIES),
  amount: nonNegativeNumber,
  file: z.instanceof(File).nullable().optional(),
});

const deductionCategoryRecord = z.object({
  "Square Fees": nonNegativeNumber.default(0),
  TX: nonNegativeNumber.default(0),
  "Delivery Fee": nonNegativeNumber.default(0),
  Marketing: nonNegativeNumber.default(0),
});

export const upsertDeductionsSchema = z.object({
  branchId: entityId,
  monthPeriod: period,
  values: deductionCategoryRecord,
});

export const quickRevenueEntrySchema = z.object({
  branch_id: entityId,
  period: period,
  sale_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  recipe_id: z
    .string()
    .trim()
    .min(1, { message: "A valid menu item is required." })
    .uuid({ message: "A valid menu item is required." }),
  quantity: z.coerce.number().int().positive(),
  unit_price: z.coerce.number().positive(),
  channel: z.enum(["delivery", "dine_in", "takeaway", "manual"]).default("manual"),
});

export const quickExpenseEntrySchema = z.object({
  branch_id: entityId,
  period: period,
  category: z.enum(MONTHLY_PNL_ALL_CATEGORIES),
  amount: nonNegativeNumber.positive(),
});

function formDataToRecord(formData: FormData): Record<string, string> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of formData.entries()) {
    entries.push([key, String(value)]);
  }
  return Object.fromEntries(entries);
}

export function parseFinancialsForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
): z.infer<T> {
  return schema.parse(formDataToRecord(formData));
}

export function safeParseFinancialsForm<T extends z.ZodTypeAny>(
  schema: T,
  formData: FormData,
){
  return schema.safeParse(formDataToRecord(formData));
}
