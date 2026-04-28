import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireBranchRow } from "@/lib/branch/require-branch-or-redirect";
import { getCurrentActor } from "@/lib/auth/actor";
import { canCreateSupplyOrder } from "@/lib/orders/supply-order-guard";
import { CommissaryOrderNotice, SupplyOrderForm, type OrderIngredient } from "@/components/orders/SupplyOrderForm";
import { TransferHistorySection } from "@/components/orders/TransferHistorySection";

export const dynamic = "force-dynamic";

export default async function BranchOrdersPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const branchRow = await requireBranchRow(id, (canonicalId) => `/branch/${canonicalId}/orders`);

  const supabase = await createClient();
  const { data: branch, error: branchError } = await supabase
    .from("branches")
    .select("name, location, type")
    .eq("id", id)
    .single();

  if (branchError || !branch) notFound();

  const { data: ingredientRows, error: ingError } = await supabase
    .from("ingredients")
    .select("id, name, unit, cost_per_unit")
    .order("name");

  if (ingError) {
    throw new Error(ingError.message);
  }

  const ingredients: OrderIngredient[] = (ingredientRows ?? []).map((r) => ({
    id: r.id,
    name: r.name,
    unit: r.unit,
    cost_per_unit: Number(r.cost_per_unit ?? 0),
  }));

  const actor = await getCurrentActor();
  const canSubmit = canCreateSupplyOrder(actor) && branch.type === "branch";

  let pendingTransferCount = 0;
  let inTransitTransferCount = 0;
  if (branch.type === "branch") {
    const [pRes, tRes] = await Promise.all([
      supabase
        .from("transfers")
        .select("id", { count: "exact", head: true })
        .eq("to_branch_id", id)
        .eq("status", "pending"),
      supabase
        .from("transfers")
        .select("id", { count: "exact", head: true })
        .eq("to_branch_id", id)
        .eq("status", "in_transit"),
    ]);
    pendingTransferCount = pRes.count ?? 0;
    inTransitTransferCount = tRes.count ?? 0;
  }

  return (
    <div
      className="flex flex-col gap-6 md:gap-8 max-w-7xl mx-auto px-0 sm:px-2 md:px-4"
      dir="ltr"
    >
      <Link
        href={`/branch/${id}`}
        className="inline-flex items-center gap-2 text-[11px] font-black tracking-[.25em] text-[#a48443]/60 hover:text-[#a48443] transition-all uppercase self-start group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        BACK TO {String(branch.name ?? branchRow.name).toUpperCase()}
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-black text-[#052e36] tracking-tight">Order supplies</h1>
        <p className="text-sm text-gray-600 max-w-2xl">
          Same flow as <span className="font-semibold text-[#052e36]">Warehouse</span>: build your line below, then
          submit. Your request is a transfer in{" "}
          <span className="font-bold text-[#052e36]">pending</span> until the commissary dispatches.
        </p>
      </header>

      {branch.type === "commissary" ? (
        <CommissaryOrderNotice />
      ) : !canCreateSupplyOrder(actor) ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          Only branch managers and super administrators can submit supply orders. Contact a manager to place an order.
        </p>
      ) : null}

      {branch.type === "branch" && (
        <SupplyOrderForm
          branchId={id}
          branchName={String(branch.name ?? "Branch")}
          branchLocation={branch.location}
          ingredients={ingredients}
          canSubmit={canSubmit}
          pendingTransferCount={pendingTransferCount}
          inTransitTransferCount={inTransitTransferCount}
        />
      )}

      <TransferHistorySection branchId={id} branchType={String(branch.type ?? "branch")} />
    </div>
  );
}
