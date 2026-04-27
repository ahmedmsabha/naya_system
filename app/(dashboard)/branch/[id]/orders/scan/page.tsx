import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireBranchRow } from "@/lib/branch/require-branch-or-redirect";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { getCurrentActor } from "@/lib/auth/actor";
import { canReceiveTransfer } from "@/lib/orders/receive-guard";
import { OrderScanView } from "@/components/orders/scan/OrderScanView";

export const dynamic = "force-dynamic";

export default async function BranchOrderScanPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const branchRow = await requireBranchRow(id, (canonicalId) => `/branch/${canonicalId}/orders/scan`);

  const supabase = await createClient();
  const { data: branch, error: bErr } = await supabase.from("branches").select("name, type").eq("id", id).single();

  if (bErr || !branch) notFound();
  if (branch.type === "commissary") notFound();

  const actor = await getCurrentActor();
  const canUse = canReceiveTransfer(actor);

  return (
    <div className="flex flex-col gap-6 md:gap-8 max-w-2xl mx-auto px-0 sm:px-2 md:px-4" dir="ltr">
      <Link
        href={`/branch/${id}`}
        className="inline-flex items-center gap-2 text-[11px] font-black tracking-[.25em] text-[#a48443]/60 hover:text-[#a48443] transition-all uppercase self-start group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        BACK TO {String(branch.name ?? branchRow.name).toUpperCase()}
      </Link>

      <header className="space-y-2">
        <h1 className="text-2xl md:text-3xl font-black text-[#052e36] tracking-tight">Receive shipment</h1>
        <p className="text-sm text-gray-600">
          Scan the QR on the commissary label. Confirm the quantities you received; stock updates for this branch when you
          submit.
        </p>
      </header>

      {!canUse ? (
        <p className="text-sm text-amber-900 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
          Only branch staff, branch managers, and super administrators can receive transfers.
        </p>
      ) : (
        <OrderScanView branchId={id} branchName={String(branch.name ?? "Branch")} />
      )}
    </div>
  );
}
