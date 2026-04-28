"use server";

import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { getCurrentActor } from "@/lib/auth/actor";
import { canManageFulfillment } from "@/lib/orders/fulfillment-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zUuidLoose } from "@/lib/validation/ids";

const dispatchSchema = z.object({
  transfer_id: zUuidLoose,
  commissary_branch_id: zUuidLoose,
});

type ActionResult = { success: true } | { error: string };

function mapRpcError(message: string): string {
  const m = message.toLowerCase();
  if (m.includes("transfer_not_found")) return "Transfer was not found.";
  if (m.includes("branch_mismatch")) return "This transfer does not belong to this commissary.";
  if (m.includes("transfer_not_pending")) return "This transfer is no longer pending.";
  if (m.includes("insufficient_stock")) {
    const short = /insufficient_stock:\s*(.+)/i.exec(message);
    if (short?.[1]) {
      return short[1].trim();
    }
    return "Commissary inventory is insufficient for one or more items.";
  }
  if (m.includes("not_authenticated")) return "Your session expired. Sign in again.";
  if (m.includes("violates row-level security") || m.includes("permission denied")) {
    return "You do not have permission to update inventory for this branch.";
  }
  if (m.includes("foreign key") || m.includes("violates foreign key constraint")) {
    return "Dispatch could not be recorded. Ensure your user profile exists in the system (users table).";
  }
  return message || "Dispatch failed.";
}

export async function dispatchTransfer(formData: FormData): Promise<ActionResult> {
  const parsed = dispatchSchema.safeParse({
    transfer_id: String(formData.get("transfer_id") ?? ""),
    commissary_branch_id: String(formData.get("commissary_branch_id") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Invalid dispatch request." };
  }

  const actor = await getCurrentActor();
  if (!canManageFulfillment(actor)) {
    return { error: "Only warehouse managers or administrators can dispatch shipments." };
  }

  const access = await authorize({
    module: "warehouse",
    action: "edit",
    branchId: parsed.data.commissary_branch_id,
  });
  if (!access.ok) {
    return { error: access.reason ?? "Unauthorized" };
  }

  const supabase = await createClient();

  const { data: branch, error: bErr } = await supabase
    .from("branches")
    .select("id, type")
    .eq("id", parsed.data.commissary_branch_id)
    .single();
  if (bErr || !branch) {
    return { error: "Branch not found." };
  }
  if (branch.type !== "commissary") {
    return { error: "Dispatch is only available on the commissary branch." };
  }

  const { error: rpcError } = await supabase.rpc("dispatch_transfer", {
    p_transfer_id: parsed.data.transfer_id,
    p_commissary_branch_id: parsed.data.commissary_branch_id,
  });

  if (rpcError) {
    return { error: mapRpcError(rpcError.message) };
  }

  const { data: tRow } = await supabase
    .from("transfers")
    .select("to_branch_id")
    .eq("id", parsed.data.transfer_id)
    .single();

  const cid = parsed.data.commissary_branch_id;
  revalidatePath(`/branch/${cid}/warehouse/fulfillment`);
  revalidatePath(`/branch/${cid}/warehouse`);

  if (tRow?.to_branch_id) {
    const dest = tRow.to_branch_id as string;
    revalidatePath(`/branch/${dest}`);
    revalidatePath(`/branch/${dest}/orders`);
  }

  return { success: true };
}
