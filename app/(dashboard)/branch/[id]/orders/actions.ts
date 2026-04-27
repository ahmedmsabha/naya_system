"use server";

import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { getCurrentActor } from "@/lib/auth/actor";
import { canCreateSupplyOrder } from "@/lib/orders/supply-order-guard";
import { revalidatePath } from "next/cache";
import { createSupplyOrderSchema, parseSupplyOrderLines, type SupplyOrderLine } from "./schemas";

type ActionResult = { success: true; transferId: string } | { error: string };

function normalizeLines(lines: SupplyOrderLine[]): { ingredientId: string; quantity: number }[] {
  return lines.filter((l) => l.quantity > 0).map((l) => ({ ingredientId: l.ingredient_id, quantity: l.quantity }));
}

export async function createSupplyOrder(
  formData: FormData,
  /** Passed explicitly so we never rely on hidden FormData fields alone (fixes empty / missing UUID). */
  toBranchIdFromPage: string,
): Promise<ActionResult> {
  const fromForm = String(formData.get("to_branch_id") ?? "").trim();
  const raw = {
    to_branch_id: toBranchIdFromPage.trim() || fromForm,
    lines_json: String(formData.get("lines_json") ?? "").trim(),
  };
  const parsed = createSupplyOrderSchema.safeParse(raw);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    return { error: first?.message ?? "Invalid order data." };
  }

  const actor = await getCurrentActor();
  if (!canCreateSupplyOrder(actor)) {
    return { error: "Only branch managers or administrators can submit supply orders." };
  }

  const access = await authorize({
    module: "warehouse",
    action: "edit",
    branchId: parsed.data.to_branch_id,
  });
  if (!access.ok) {
    return { error: access.reason ?? "Unauthorized" };
  }

  let lines: ReturnType<typeof normalizeLines>;
  try {
    lines = normalizeLines(parseSupplyOrderLines(parsed.data.lines_json));
  } catch {
    return { error: "Invalid line items." };
  }

  if (lines.length === 0) {
    return { error: "Add at least one ingredient with a quantity greater than zero." };
  }

  const supabase = await createClient();
  const ingredientIds = Array.from(new Set(lines.map((l) => l.ingredientId)));
  const { data: ingredients, error: ingErr } = await supabase
    .from("ingredients")
    .select("id, cost_per_unit")
    .in("id", ingredientIds);
  if (ingErr) {
    return { error: ingErr.message };
  }
  if (!ingredients || ingredients.length !== ingredientIds.length) {
    return { error: "One or more ingredients are invalid or no longer available." };
  }
  const costById = new Map(ingredients.map((r) => [r.id, Number(r.cost_per_unit ?? 0)]));

  const { data: toBranch, error: toErr } = await supabase
    .from("branches")
    .select("id, type")
    .eq("id", parsed.data.to_branch_id)
    .single();
  if (toErr || !toBranch) {
    return { error: "Branch not found." };
  }
  if (toBranch.type === "commissary") {
    return { error: "Commissary locations place orders through other workflows, not as a receiving branch." };
  }

  const { data: commissary, error: cErr } = await supabase
    .from("branches")
    .select("id")
    .eq("type", "commissary")
    .limit(1)
    .maybeSingle();
  if (cErr) {
    return { error: cErr.message };
  }
  if (!commissary?.id) {
    return { error: "No commissary branch is configured. Add a branch with type \"commissary\"." };
  }
  if (commissary.id === parsed.data.to_branch_id) {
    return { error: "Invalid order destination." };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "Session expired. Sign in again." };
  }

  const { data: transfer, error: tErr } = await supabase
    .from("transfers")
    .insert({
      from_branch_id: commissary.id,
      to_branch_id: parsed.data.to_branch_id,
      status: "pending",
      created_by: user.id,
    })
    .select("id")
    .single();

  if (tErr || !transfer) {
    return { error: tErr?.message ?? "Could not create transfer." };
  }

  const itemRows = lines.map((l) => ({
    transfer_id: transfer.id,
    ingredient_id: l.ingredientId,
    quantity_sent: l.quantity,
    unit_cost: costById.get(l.ingredientId) ?? 0,
    markup_pct: 0,
  }));

  const { error: iErr } = await supabase.from("transfer_items").insert(itemRows);
  if (iErr) {
    await supabase.from("transfers").delete().eq("id", transfer.id);
    return { error: iErr.message };
  }

  revalidatePath(`/branch/${parsed.data.to_branch_id}/orders`);
  revalidatePath(`/branch/${commissary.id}/warehouse/fulfillment`);
  revalidatePath(`/branch/${commissary.id}/warehouse`);
  return { success: true, transferId: transfer.id };
}
