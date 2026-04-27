"use server";

import { createClient } from "@/lib/supabase/server";
import { authorize } from "@/lib/auth/authorize";
import { getCurrentActor } from "@/lib/auth/actor";
import { canReceiveTransfer } from "@/lib/orders/receive-guard";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { zUuidLoose } from "@/lib/validation/ids";

const lineInSchema = z.object({
  transfer_item_id: zUuidLoose,
  quantity_received: z.coerce.number().min(0).finite(),
});

export type ReceiveLine = z.infer<typeof lineInSchema>;

const receiveSchema = z.object({
  to_branch_id: zUuidLoose,
  transfer_id: zUuidLoose,
  /** Client sends JSON.stringify(ReceiveLine[]); "[]" is valid when there are no lines. */
  lines_json: z.string().min(1),
});

export type ReceivingItem = {
  transferItemId: string;
  ingredientName: string;
  unit: string;
  quantitySent: number;
};

export type ReceivingTransferPayload = {
  id: string;
  destinationName: string;
  status: string;
  items: ReceivingItem[];
};

type LoadResult = { ok: true; data: ReceivingTransferPayload } | { error: string };

export async function getTransferForReceiving(
  transferId: string,
  branchId: string,
): Promise<LoadResult> {
  const idParse = zUuidLoose.safeParse(transferId);
  if (!idParse.success) {
    return { error: "Invalid transfer ID in QR code." };
  }

  const actor = await getCurrentActor();
  if (!canReceiveTransfer(actor)) {
    return { error: "You do not have permission to receive transfers." };
  }

  const access = await authorize({
    module: "warehouse",
    action: "read",
    branchId,
  });
  if (!access.ok) {
    return { error: access.reason ?? "Unauthorized" };
  }

  const supabase = await createClient();
  const { data: t, error: tErr } = await supabase
    .from("transfers")
    .select("id, status, to_branch_id, from_branch_id")
    .eq("id", transferId)
    .single();

  if (tErr || !t) {
    return { error: "Transfer not found." };
  }

  if (t.to_branch_id !== branchId) {
    return { error: "This shipment is not addressed to this branch. Switch to the correct location." };
  }

  if (t.status === "received") {
    return { error: "This transfer has already been received." };
  }

  if (t.status !== "in_transit") {
    return {
      error: `This transfer is not available to receive (status: ${t.status ?? "unknown"}). It must be in transit from the commissary.`,
    };
  }

  const { data: dest } = await supabase.from("branches").select("name").eq("id", branchId).single();

  const { data: lines, error: lErr } = await supabase
    .from("transfer_items")
    .select("id, quantity_sent, ingredient_id")
    .eq("transfer_id", transferId)
    .order("id");

  if (lErr) {
    return { error: lErr.message };
  }

  const ingIds = Array.from(
    new Set((lines ?? []).map((row) => row.ingredient_id).filter(Boolean)),
  ) as string[];

  const { data: ingRows, error: ingErr } =
    ingIds.length > 0
      ? await supabase.from("ingredients").select("id, name, unit").in("id", ingIds)
      : { data: [] as { id: string; name: string; unit: string }[], error: null };

  if (ingErr) {
    return { error: ingErr.message };
  }

  const ingById = new Map((ingRows ?? []).map((r) => [r.id, r]));

  const items: ReceivingItem[] = (lines ?? []).map((row) => {
    const ing = ingById.get(row.ingredient_id as string);
    return {
      transferItemId: row.id,
      ingredientName: ing?.name ?? "Unknown",
      unit: ing?.unit ?? "—",
      quantitySent: Number(row.quantity_sent ?? 0),
    };
  });

  return {
    ok: true,
    data: {
      id: t.id,
      destinationName: dest?.name ?? "This branch",
      status: t.status,
      items,
    },
  };
}

function mapReceiveError(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes("transfer_not_found")) return "Transfer not found.";
  if (m.includes("branch_mismatch")) return "This transfer does not belong to this branch.";
  if (m.includes("already_received")) return "This transfer has already been received.";
  if (m.includes("not_in_transit")) return "This transfer is not in transit. It may still be at the commissary.";
  if (m.includes("not_authenticated")) return "Session expired. Sign in again.";
  if (m.includes("invalid_lines") || m.includes("line_count_mismatch") || m.includes("duplicate_line_item")) {
    return "Line items do not match the transfer. Refresh and try again.";
  }
  if (m.includes("unknown_line_item") || m.includes("invalid_line")) {
    return "Invalid quantities or line data.";
  }
  if (m.includes("foreign key") || m.includes("violates foreign key")) {
    return "Could not update inventory. Ensure your user profile exists in the system.";
  }
  if (m.includes("violates row-level security") || m.includes("permission denied")) {
    return "You do not have permission to update inventory for this branch.";
  }
  return msg || "Receive failed.";
}

export type ReceiveResult = { success: true; status: "received" | "disputed" } | { error: string };

export async function receiveTransfer(formData: FormData): Promise<ReceiveResult> {
  const parsed = receiveSchema.safeParse({
    to_branch_id: String(formData.get("to_branch_id") ?? ""),
    transfer_id: String(formData.get("transfer_id") ?? ""),
    lines_json: String(formData.get("lines_json") ?? ""),
  });
  if (!parsed.success) {
    return { error: "Invalid receive data. Refresh the page, scan the QR again, and confirm." };
  }

  const actor = await getCurrentActor();
  if (!canReceiveTransfer(actor)) {
    return { error: "You do not have permission to receive transfers." };
  }

  const access = await authorize({
    module: "warehouse",
    action: "edit",
    branchId: parsed.data.to_branch_id,
  });
  if (!access.ok) {
    return { error: access.reason ?? "Unauthorized" };
  }

  let lines: ReceiveLine[];
  try {
    const raw = JSON.parse(parsed.data.lines_json) as unknown;
    lines = z.array(lineInSchema).parse(raw);
  } catch {
    return { error: "Invalid line items." };
  }

  const supabase = await createClient();
  const { error: rpcError } = await supabase.rpc("receive_transfer", {
    p_transfer_id: parsed.data.transfer_id,
    p_to_branch_id: parsed.data.to_branch_id,
    p_lines: lines,
  });

  if (rpcError) {
    return { error: mapReceiveError(rpcError.message) };
  }

  const { data: st } = await supabase
    .from("transfers")
    .select("status")
    .eq("id", parsed.data.transfer_id)
    .single();

  const finalStatus = st?.status === "disputed" ? "disputed" : "received";
  const branchId = parsed.data.to_branch_id;
  revalidatePath(`/branch/${branchId}`);
  revalidatePath(`/branch/${branchId}/warehouse`);
  revalidatePath(`/branch/${branchId}/orders/scan`);
  revalidatePath(`/branch/${branchId}/orders`);
  return { success: true, status: finalStatus === "disputed" ? "disputed" : "received" };
}
