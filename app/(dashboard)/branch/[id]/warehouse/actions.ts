"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getWeekDatesForDate, parseWarehouseIsoDate, type WeekdayKey } from "@/lib/warehouse/week-dates";

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
  revalidatePath(`/branch/${branchId}/warehouse`);
  revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  return { success: true };
}

/** Set purchase quantity for a specific calendar day (does not change on-hand inventory). */
export async function setDistributionQuantity(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const ingredientId = String(formData.get("ingredient_id") ?? "");
  const date = String(formData.get("date") ?? "");
  const quantity = Math.max(0, parseFloat(String(formData.get("quantity") ?? "0")) || 0);

  if (!branchId || !ingredientId || !date) return { error: "Missing branch, ingredient, or date" };

  const { error } = await supabase.from("warehouse_distributions").upsert(
    { branch_id: branchId, ingredient_id: ingredientId, distributed_at: date, quantity },
    { onConflict: "branch_id,ingredient_id,distributed_at" }
  );

  if (error) return { error: error.message };
  revalidatePath(`/branch/${branchId}/warehouse`);
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
  revalidatePath(`/branch/${branchId}/warehouse`);
  revalidatePath(`/branch/${branchId}/warehouse/schedule`);
  return { success: true };
}

// ─── Invoices ───────────────────────────────────────────────────────────────

const WEEK_DAYS: WeekdayKey[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function buildWeeklyInvoiceNumber(branchId: string, weekStartIso: string) {
  const hash = branchId.replace(/-/g, "").slice(0, 6).toUpperCase();
  const compactWeek = weekStartIso.replace(/-/g, "");
  return `NF-${hash}-${compactWeek}`;
}

type WeeklyIngredientTotals = {
  ingredient_id: string;
  quantity: number;
  unit_cost: number;
};

async function buildWeeklyInvoiceSnapshot(
  branchId: string,
  anchorDateIso: string
): Promise<{
  weekStartIso: string;
  weekEndIso: string;
  invoiceItems: WeeklyIngredientTotals[];
  totalAmount: number;
}> {
  const supabase = await createClient();
  const weekDates = getWeekDatesForDate(anchorDateIso);
  const weekStartIso = weekDates.MONDAY;
  const weekEndIso = weekDates.SUNDAY;

  const dateToDayKey: Record<string, WeekdayKey> = WEEK_DAYS.reduce((map, day) => {
    map[weekDates[day]] = day;
    return map;
  }, {} as Record<string, WeekdayKey>);

  const { data: distRows, error: distError } = await supabase
    .from("warehouse_distributions")
    .select("ingredient_id, quantity, distributed_at")
    .eq("branch_id", branchId)
    .gte("distributed_at", weekStartIso)
    .lte("distributed_at", weekEndIso)
    .gt("quantity", 0);

  if (distError) {
    throw new Error(distError.message);
  }

  const totalsByIngredient = new Map<string, number>();
  for (const row of distRows ?? []) {
    if (!dateToDayKey[row.distributed_at]) continue;
    const prev = totalsByIngredient.get(row.ingredient_id) ?? 0;
    totalsByIngredient.set(row.ingredient_id, prev + Number(row.quantity ?? 0));
  }

  if (totalsByIngredient.size === 0) {
    return { weekStartIso, weekEndIso, invoiceItems: [], totalAmount: 0 };
  }

  const ingredientIds = Array.from(totalsByIngredient.keys());
  const { data: ingredientRows, error: ingredientError } = await supabase
    .from("ingredients")
    .select("id, cost_per_unit")
    .in("id", ingredientIds);

  if (ingredientError) {
    throw new Error(ingredientError.message);
  }

  const costByIngredientId: Record<string, number> = {};
  for (const ingredient of ingredientRows ?? []) {
    costByIngredientId[ingredient.id] = Number(ingredient.cost_per_unit ?? 0);
  }

  const invoiceItems: WeeklyIngredientTotals[] = ingredientIds
    .map((ingredientId) => {
      const quantity = Number(totalsByIngredient.get(ingredientId) ?? 0);
      return {
        ingredient_id: ingredientId,
        quantity,
        unit_cost: costByIngredientId[ingredientId] ?? 0,
      };
    })
    .filter((row) => row.quantity > 0);

  const totalAmount = invoiceItems.reduce((sum, row) => sum + row.quantity * row.unit_cost, 0);
  return { weekStartIso, weekEndIso, invoiceItems, totalAmount };
}

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

/**
 * Creates or updates one weekly invoice (Mon-Sun) for a branch.
 * If a weekly invoice already exists (including archived), it is recalculated in-place.
 */
export async function upsertWeeklyInvoice(formData: FormData) {
  const supabase = await createClient();
  const branchId = String(formData.get("branch_id") ?? "");
  const requestedStatusRaw = String(formData.get("status") ?? "");
  const requestedStatus = requestedStatusRaw || "pending";
  const forceArchived = String(formData.get("force_archived") ?? "") === "true";
  const anchorDateRaw =
    String(formData.get("anchor_date") ?? "") ||
    String(formData.get("purchase_date") ?? "") ||
    String(formData.get("date") ?? "");
  const anchorDateIso = parseWarehouseIsoDate(anchorDateRaw);

  if (!branchId) return { error: "Missing branch_id" };

  try {
    const { weekStartIso, weekEndIso, invoiceItems, totalAmount } = await buildWeeklyInvoiceSnapshot(
      branchId,
      anchorDateIso
    );

    if (invoiceItems.length === 0) {
      return { error: "No purchases found for the selected week." };
    }

    const { data: weeklyInvoices, error: fetchInvoiceError } = await supabase
      .from("warehouse_invoices")
      .select("id, invoice_number, status, created_at")
      .eq("branch_id", branchId)
      .eq("billing_period_start", weekStartIso)
      .eq("billing_period_end", weekEndIso)
      .order("created_at", { ascending: false });

    if (fetchInvoiceError) {
      throw new Error(fetchInvoiceError.message);
    }

    const [keptInvoice, ...duplicateInvoices] = weeklyInvoices ?? [];
    if (duplicateInvoices.length > 0) {
      const duplicateIds = duplicateInvoices.map((inv) => inv.id);
      const { error: dupItemsDeleteError } = await supabase
        .from("warehouse_invoice_items")
        .delete()
        .in("invoice_id", duplicateIds);
      if (dupItemsDeleteError) throw new Error(dupItemsDeleteError.message);

      const { error: dupInvoicesDeleteError } = await supabase
        .from("warehouse_invoices")
        .delete()
        .in("id", duplicateIds);
      if (dupInvoicesDeleteError) throw new Error(dupInvoicesDeleteError.message);
    }

    let invoiceId: string;
    if (keptInvoice?.id) {
      const nextStatus = forceArchived
        ? "archived"
        : keptInvoice.status === "archived"
        ? "archived"
        : requestedStatus || keptInvoice.status || "pending";
      const { error: updateInvoiceError } = await supabase
        .from("warehouse_invoices")
        .update({
          total_amount: totalAmount,
          status: nextStatus,
        })
        .eq("id", keptInvoice.id);
      if (updateInvoiceError) throw new Error(updateInvoiceError.message);
      invoiceId = keptInvoice.id;
    } else {
      const invoiceNumber = buildWeeklyInvoiceNumber(branchId, weekStartIso);
      const { data: newInvoice, error: createInvoiceError } = await supabase
        .from("warehouse_invoices")
        .insert({
          branch_id: branchId,
          invoice_number: invoiceNumber,
          total_amount: totalAmount,
          billing_period_start: weekStartIso,
          billing_period_end: weekEndIso,
          status: forceArchived ? "archived" : requestedStatus,
        })
        .select("id")
        .single();

      if (createInvoiceError?.code === "23505") {
        const { data: conflictInvoice, error: conflictFetchError } = await supabase
          .from("warehouse_invoices")
          .select("id, status")
          .eq("branch_id", branchId)
          .eq("billing_period_start", weekStartIso)
          .eq("billing_period_end", weekEndIso)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (conflictFetchError || !conflictInvoice?.id) {
          throw new Error(conflictFetchError?.message ?? "Failed to resolve weekly invoice conflict");
        }

        const conflictStatus = forceArchived
          ? "archived"
          : conflictInvoice.status === "archived"
          ? "archived"
          : requestedStatus || conflictInvoice.status || "pending";
        const { error: conflictUpdateError } = await supabase
          .from("warehouse_invoices")
          .update({
            total_amount: totalAmount,
            status: conflictStatus,
          })
          .eq("id", conflictInvoice.id);
        if (conflictUpdateError) throw new Error(conflictUpdateError.message);
        invoiceId = conflictInvoice.id;
      } else if (createInvoiceError || !newInvoice?.id) {
        throw new Error(createInvoiceError?.message ?? "Failed to create weekly invoice");
      } else {
        invoiceId = newInvoice.id;
      }
    }

    const { error: deleteItemsError } = await supabase
      .from("warehouse_invoice_items")
      .delete()
      .eq("invoice_id", invoiceId);
    if (deleteItemsError) throw new Error(deleteItemsError.message);

    const nextItemRows = invoiceItems.map((row) => ({
      invoice_id: invoiceId,
      ingredient_id: row.ingredient_id,
      quantity: row.quantity,
      unit_cost: row.unit_cost,
    }));

    if (nextItemRows.length > 0) {
      const { error: insertItemsError } = await supabase.from("warehouse_invoice_items").insert(nextItemRows);
      if (insertItemsError) throw new Error(insertItemsError.message);
    }

    revalidatePath(`/branch/${branchId}/warehouse`);
    revalidatePath(`/branch/${branchId}/warehouse/invoice`);
    revalidatePath(`/branch/${branchId}/warehouse/archive`);
    revalidatePath(`/branch/${branchId}/warehouse/schedule`);
    return {
      success: true,
      invoice_id: invoiceId,
      billing_period_start: weekStartIso,
      billing_period_end: weekEndIso,
    };
  } catch (error) {
    console.error("Archive Error:", error);
    return { error: error instanceof Error ? error.message : "Unknown archive failure" };
  }
}

/**
 * Explicit archiving endpoint for weekly invoices.
 * Ensures invoice exists for the week, recalculates current totals/items, then marks status archived.
 */
export async function archiveWeeklyInvoice(formData: FormData) {
  const branchId = String(formData.get("branch_id") ?? "");
  if (!branchId) return { error: "Missing branch_id" };

  const fd = new FormData();
  fd.set("branch_id", branchId);
  fd.set("status", "archived");
  fd.set("force_archived", "true");

  const anchorDateRaw =
    String(formData.get("anchor_date") ?? "") ||
    String(formData.get("purchase_date") ?? "") ||
    String(formData.get("date") ?? "");
  if (anchorDateRaw) {
    fd.set("anchor_date", anchorDateRaw);
  }

  return upsertWeeklyInvoice(fd);
}

export async function archiveInvoice(formData: FormData) {
  const branchId = String(formData.get("branch_id") ?? "");
  if (!branchId) return { error: "Missing branch_id" };

  const result = await archiveWeeklyInvoice(formData);
  if (result?.error) return result;
  redirect(`/branch/${branchId}/warehouse/archive`);
}
