"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

// ─── Inventory Items ────────────────────────────────────────────────────────

export async function addIngredient(formData: FormData) {
  const supabase = await createClient();
  const branchId = formData.get("branch_id") as string;
  const name = formData.get("name") as string;
  const unit = (formData.get("unit") as string) || "UNIT";
  const costPerUnit = parseFloat((formData.get("cost_per_unit") as string) || "0");

  if (!name.trim()) return { error: "Item name is required" };

  // Insert into ingredients (global)
  const { data: ingredient, error: ingError } = await supabase
    .from("ingredients")
    .insert({ name: name.trim(), unit, cost_per_unit: costPerUnit, low_stock_threshold: 0 })
    .select()
    .single();

  if (ingError) return { error: ingError.message };

  // Seed an inventory row for this branch
  const { error: invError } = await supabase.from("inventory").insert({
    branch_id: branchId,
    ingredient_id: ingredient.id,
    quantity_on_hand: 0,
    counted_at: new Date().toISOString().split("T")[0],
  });

  if (invError) return { error: invError.message };

  revalidatePath(`/branch/${branchId}/warehouse`);
  revalidatePath(`/branch/${branchId}/warehouse/invoice`);
  revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  return { success: true };
}

export async function updateQuantity(formData: FormData) {
  const supabase = await createClient();
  const inventoryId = formData.get("inventory_id") as string;
  const branchId = formData.get("branch_id") as string;
  const delta = parseInt(formData.get("delta") as string, 10);

  // Fetch current quantity
  const { data: inv, error: fetchError } = await supabase
    .from("inventory")
    .select("quantity_on_hand, ingredient_id")
    .eq("id", inventoryId)
    .single();

  if (fetchError || !inv) return { error: "Inventory record not found" };

  const newQty = Math.max(0, Number(inv.quantity_on_hand) + delta);

  const { error } = await supabase
    .from("inventory")
    .update({ quantity_on_hand: newQty, counted_at: new Date().toISOString().split("T")[0] })
    .eq("id", inventoryId);

  if (error) return { error: error.message };

  // Log PURCHASES into the schedule table (positive deltas only)
  if (delta > 0) {
    const today = new Date().toISOString().split("T")[0];
    const ingredientId = inv.ingredient_id as string;
    const { data: existing } = await supabase
      .from("warehouse_distributions")
      .select("quantity")
      .eq("branch_id", branchId)
      .eq("ingredient_id", ingredientId)
      .eq("distributed_at", today)
      .maybeSingle();

    const next = Number(existing?.quantity ?? 0) + delta;
    const { error: distError } = await supabase.from("warehouse_distributions").upsert(
      { branch_id: branchId, ingredient_id: ingredientId, distributed_at: today, quantity: next },
      { onConflict: "branch_id,ingredient_id,distributed_at" }
    );
    if (distError) return { error: distError.message };
  }

  revalidatePath(`/branch/${branchId}/warehouse`);
  revalidatePath(`/branch/${branchId}/warehouse/invoice`);
  revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  return { success: true };
}

export async function setQuantity(formData: FormData) {
  const supabase = await createClient();
  const inventoryId = formData.get("inventory_id") as string;
  const branchId = formData.get("branch_id") as string;
  const quantity = Math.max(0, parseFloat(formData.get("quantity") as string) || 0);

  // Fetch current to compute delta (so we can log purchases by day)
  const { data: inv, error: fetchError } = await supabase
    .from("inventory")
    .select("quantity_on_hand, ingredient_id")
    .eq("id", inventoryId)
    .single();
  if (fetchError || !inv) return { error: "Inventory record not found" };

  const delta = quantity - Number(inv.quantity_on_hand);

  const { error } = await supabase
    .from("inventory")
    .update({ quantity_on_hand: quantity, counted_at: new Date().toISOString().split("T")[0] })
    .eq("id", inventoryId);

  if (error) return { error: error.message };

  // Log PURCHASES into the schedule table (positive deltas only)
  if (delta > 0) {
    const today = new Date().toISOString().split("T")[0];
    const ingredientId = inv.ingredient_id as string;
    const { data: existing } = await supabase
      .from("warehouse_distributions")
      .select("quantity")
      .eq("branch_id", branchId)
      .eq("ingredient_id", ingredientId)
      .eq("distributed_at", today)
      .maybeSingle();

    const next = Number(existing?.quantity ?? 0) + delta;
    const { error: distError } = await supabase.from("warehouse_distributions").upsert(
      { branch_id: branchId, ingredient_id: ingredientId, distributed_at: today, quantity: next },
      { onConflict: "branch_id,ingredient_id,distributed_at" }
    );
    if (distError) return { error: distError.message };
  }

  revalidatePath(`/branch/${branchId}/warehouse`);
  revalidatePath(`/branch/${branchId}/warehouse/invoice`);
  revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  return { success: true };
}

export async function deleteInventoryItem(formData: FormData) {
  const supabase = await createClient();
  const inventoryId = formData.get("inventory_id") as string;
  const branchId = formData.get("branch_id") as string;

  const { error } = await supabase.from("inventory").delete().eq("id", inventoryId).eq("branch_id", branchId);
  if (error) return { error: error.message };

  revalidatePath(`/branch/${branchId}/warehouse`);
  revalidatePath(`/branch/${branchId}/warehouse/invoice`);
  revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  return { success: true };
}

// ─── Weekly Schedule ────────────────────────────────────────────────────────

export async function upsertDistribution(formData: FormData) {
  const supabase = await createClient();
  const branchId = formData.get("branch_id") as string;
  const ingredientId = formData.get("ingredient_id") as string;
  const date = formData.get("date") as string;
  const quantity = parseFloat(formData.get("quantity") as string) || 0;

  const { error } = await supabase.from("warehouse_distributions").upsert(
    { branch_id: branchId, ingredient_id: ingredientId, distributed_at: date, quantity },
    { onConflict: "branch_id,ingredient_id,distributed_at" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  return { success: true };
}

export async function resetDistributions(formData: FormData) {
  const supabase = await createClient();
  const branchId = formData.get("branch_id") as string;
  const weekStart = formData.get("week_start") as string;
  const weekEnd = formData.get("week_end") as string;

  const { error } = await supabase
    .from("warehouse_distributions")
    .delete()
    .eq("branch_id", branchId)
    .gte("distributed_at", weekStart)
    .lte("distributed_at", weekEnd);

  if (error) return { error: error.message };
  revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  return { success: true };
}

// ─── Invoices ───────────────────────────────────────────────────────────────

export async function deleteArchivedInvoice(formData: FormData) {
  const supabase = await createClient();
  const invoiceId = formData.get("invoice_id") as string;
  const branchId = formData.get("branch_id") as string;

  const { error } = await supabase
    .from("warehouse_invoices")
    .delete()
    .eq("id", invoiceId);

  if (error) return { error: error.message };
  revalidatePath(`/branch/${branchId}/warehouse/archive`);
  return { success: true };
}

export async function archiveInvoice(formData: FormData) {
  const supabase = await createClient();
  let invoiceId = formData.get("invoice_id") as string;
  const branchId = formData.get("branch_id") as string;

  try {
    // If no specific invoice record exists yet, create one from current inventory data
    if (!invoiceId || invoiceId === "null" || invoiceId === "undefined") {
      // 1. Calculate total valuation
      const { data: items } = await supabase
        .from("inventory")
        .select(`ingredient_id, quantity_on_hand, ingredients ( cost_per_unit )`)
        .eq("branch_id", branchId)
        .gt("quantity_on_hand", 0);

      const totalAmount = (items ?? []).reduce((sum, row) => {
        const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
        return sum + (Number(row.quantity_on_hand) * Number(ing?.cost_per_unit ?? 0));
      }, 0);

      // 2. Generate a reference number
      const hash = branchId.replace(/-/g, "").slice(0, 6).toUpperCase();
      const invoiceNumber = `NF-${hash}-${Date.now().toString().slice(-4)}`;
      const periodEnd = new Date();
      const periodStart = new Date();
      periodStart.setDate(periodEnd.getDate() - 7);

      // 3. Create the record
      const { data: newInvoice, error: createError } = await supabase
        .from("warehouse_invoices")
        .insert({
          branch_id: branchId,
          invoice_number: invoiceNumber,
          total_amount: totalAmount,
          billing_period_start: periodStart.toISOString().split("T")[0],
          billing_period_end: periodEnd.toISOString().split("T")[0],
          status: "archived" 
        })
        .select()
        .single();

      if (createError) throw new Error(createError.message);
      invoiceId = newInvoice.id;

      // 4. Persist invoice line items for archive + historical review
      const lineRows =
        (items ?? [])
          .map((row) => {
            const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
            const qty = Number(row.quantity_on_hand);
            const unitCost = Number(ing?.cost_per_unit ?? 0);
            if (!row.ingredient_id || qty <= 0) return null;
            return {
              invoice_id: newInvoice.id,
              ingredient_id: row.ingredient_id,
              quantity: qty,
              unit_cost: unitCost,
            };
          })
          .filter(Boolean) as Array<{
          invoice_id: string;
          ingredient_id: string;
          quantity: number;
          unit_cost: number;
        }>;

      if (lineRows.length) {
        const { error: itemsError } = await supabase.from("warehouse_invoice_items").insert(lineRows);
        if (itemsError) throw new Error(itemsError.message);
      }
    } else {
      // Update existing record to archived
      const { error } = await supabase
        .from("warehouse_invoices")
        .update({ status: "archived" })
        .eq("id", invoiceId);

      if (error) throw new Error(error.message);
    }

    // After archiving, reset branch inventory quantities to 0
    // so the next invoice starts from a clean slate.
    const { error: resetError } = await supabase
      .from("inventory")
      .update({ quantity_on_hand: 0, counted_at: new Date().toISOString().split("T")[0] })
      .eq("branch_id", branchId);
    if (resetError) throw new Error(resetError.message);

    revalidatePath(`/branch/${branchId}/warehouse`);
    revalidatePath(`/branch/${branchId}/warehouse/invoice`);
    revalidatePath(`/branch/${branchId}/warehouse/archive`);
    revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  } catch (error) {
    console.error("Archive Error:", error);
    return { error: error instanceof Error ? error.message : "Unknown archive failure" };
  }

  // Use server-side redirect for maximum reliability
  redirect(`/branch/${branchId}/warehouse/archive`);
}
