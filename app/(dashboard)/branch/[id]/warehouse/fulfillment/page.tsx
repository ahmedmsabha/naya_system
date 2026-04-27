import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireBranchRow } from "@/lib/branch/require-branch-or-redirect";
import { getCurrentActor } from "@/lib/auth/actor";
import { canManageFulfillment } from "@/lib/orders/fulfillment-guard";
import {
  FulfillmentOrderList,
  type FulfillmentOrderRow,
} from "@/components/warehouse/fulfillment/FulfillmentOrderList";

export const dynamic = "force-dynamic";

export default async function WarehouseFulfillmentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const branchRow = await requireBranchRow(id, (canonicalId) => `/branch/${canonicalId}/warehouse/fulfillment`);

  const supabase = await createClient();
  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("name, location, type")
    .eq("id", id)
    .single();

  if (branchError || !branch) notFound();
  if (branch.type !== "commissary") notFound();

  const actor = await getCurrentActor();
  const canAccess = canManageFulfillment(actor);

  const { data: transferRows, error: tErr } = await supabase
    .from("transfers")
    .select("id, status, created_at, dispatched_at, to_branch_id, transfer_items ( quantity_sent, ingredient_id )")
    .eq("from_branch_id", id)
    .in("status", ["pending", "in_transit"])
    .order("created_at", { ascending: false });

  if (tErr) {
    throw new Error(tErr.message);
  }

  const toIds = Array.from(new Set((transferRows ?? []).map((t) => t.to_branch_id).filter(Boolean))) as string[];
  const { data: destBranches } =
    toIds.length > 0
      ? await supabase.from("branches").select("id, name").in("id", toIds)
      : { data: [] as { id: string; name: string }[] };

  const destById = new Map((destBranches ?? []).map((b) => [b.id, b.name ?? "Branch"]));

  const allIngredientIds = new Set<string>();
  for (const t of transferRows ?? []) {
    for (const row of t.transfer_items ?? []) {
      if (row.ingredient_id) allIngredientIds.add(row.ingredient_id as string);
    }
  }

  const ingIds = Array.from(allIngredientIds);
  const { data: ingredientRows } =
    ingIds.length > 0
      ? await supabase.from("ingredients").select("id, name, unit").in("id", ingIds)
      : { data: [] as { id: string; name: string; unit: string }[] };

  const ingById = new Map((ingredientRows ?? []).map((r) => [r.id, r]));

  const orders: FulfillmentOrderRow[] = (transferRows ?? []).map((t) => {
    const items = (t.transfer_items ?? []).map((row) => {
      const ing = ingById.get(row.ingredient_id as string);
      return {
        name: ing?.name ?? "Unknown",
        unit: ing?.unit ?? "—",
        quantity: Number(row.quantity_sent ?? 0),
      };
    });
    const st = t.status === "in_transit" ? "in_transit" : "pending";
    return {
      id: t.id,
      status: st,
      createdAt: t.created_at ?? new Date().toISOString(),
      dispatchedAt: t.dispatched_at,
      destinationName: destById.get(t.to_branch_id as string) ?? "Unknown branch",
      items,
    };
  });

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-4xl w-full" dir="ltr">
      <Link
        href={`/branch/${id}/warehouse`}
        className="inline-flex items-center gap-2 text-[11px] font-black tracking-[.25em] text-[#a48443]/60 hover:text-[#a48443] transition-all uppercase self-start group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        BACK TO WAREHOUSE — {String(branch.name ?? branchRow.name).toUpperCase()}
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-black text-[#052e36] tracking-tight">Fulfillment</h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          Review branch supply orders, dispatch when stock is available, and print shipment labels for in-transit transfers.
        </p>
      </header>

      {!canAccess ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          Only warehouse managers and super administrators can manage commissary fulfillment.
        </p>
      ) : null}

      <FulfillmentOrderList commissaryBranchId={id} orders={orders} canDispatch={canAccess} />
    </div>
  );
}
