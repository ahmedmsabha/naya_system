"use client";

import { useTransition } from "react";
import { Trash2 } from "lucide-react";
import { deleteArchivedInvoice } from "@/app/(dashboard)/branch/[id]/warehouse/actions";

export function DeleteArchiveButton({
  invoiceId,
  branchId,
}: {
  invoiceId: string;
  branchId: string;
}) {
  const [isPending, startTransition] = useTransition();

  const handleDelete = () => {
    if (!confirm("Delete this archived invoice? This cannot be undone.")) return;
    startTransition(async () => {
      const fd = new FormData();
      fd.set("invoice_id", invoiceId);
      fd.set("branch_id", branchId);
      await deleteArchivedInvoice(fd);
    });
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isPending}
      className="flex items-center gap-2 w-full justify-center py-4 rounded-2xl border border-red-100 text-red-400 hover:bg-red-50 hover:text-red-600 hover:border-red-200 transition-all text-xs font-black uppercase tracking-widest disabled:opacity-40"
    >
      <Trash2 className="w-4 h-4" />
      {isPending ? "Deleting…" : "Delete"}
    </button>
  );
}
