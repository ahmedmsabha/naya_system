"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { quickExpenseEntrySchema, quickRevenueEntrySchema } from "./schemas";

type FormState = {
  success: boolean;
  message?: string;
  error?: string;
};

function toFormRecord(formData: FormData): Record<string, string> {
  const entries: Array<[string, string]> = [];
  for (const [key, value] of formData.entries()) {
    entries.push([key, String(value)]);
  }
  return Object.fromEntries(entries);
}

export async function addRevenueEntryAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = quickRevenueEntrySchema.safeParse(toFormRecord(formData));
  if (!parsed.success) return { success: false, error: "Invalid revenue payload." };

  const supabase = await createClient();
  const input = parsed.data;
  const { error } = await supabase.from("sales").insert({
    branch_id: input.branch_id,
    recipe_id: input.recipe_id,
    quantity_sold: input.quantity,
    unit_price: Number(input.unit_price.toFixed(2)),
    sale_date: input.sale_date,
    source: input.channel,
  });

  if (error) return { success: false, error: error.message };

  revalidatePath(`/branch/${input.branch_id}/financials`);
  return { success: true, message: "Revenue entry added successfully." };
}

export async function addExpenseEntryAction(_: FormState, formData: FormData): Promise<FormState> {
  const parsed = quickExpenseEntrySchema.safeParse(toFormRecord(formData));
  if (!parsed.success) return { success: false, error: "Invalid expense payload." };

  const supabase = await createClient();
  const input = parsed.data;

  const { data: existing, error: fetchError } = await supabase
    .from("branch_monthly_expenses")
    .select("amount")
    .eq("branch_id", input.branch_id)
    .eq("month_period", input.period)
    .eq("category", input.category)
    .maybeSingle();

  if (fetchError) return { success: false, error: fetchError.message };

  const nextAmount = Number(existing?.amount ?? 0) + input.amount;
  const { error } = await supabase.from("branch_monthly_expenses").upsert(
    {
      branch_id: input.branch_id,
      month_period: input.period,
      category: input.category,
      amount: Number(nextAmount.toFixed(2)),
    },
    { onConflict: "branch_id,month_period,category" },
  );

  if (error) return { success: false, error: error.message };

  revalidatePath(`/branch/${input.branch_id}/financials`);
  return { success: true, message: "Expense entry added successfully." };
}

