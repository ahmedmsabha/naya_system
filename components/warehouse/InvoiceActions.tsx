"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Box, Loader2 } from "lucide-react";
import { archiveInvoice } from "@/app/(dashboard)/branch/[id]/warehouse/actions";

export function InvoiceActions({
  branchId,
  branchName,
  invoiceId,
}: {
  branchId: string;
  branchName: string;
  invoiceId?: string | null;
}) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handlePrint = () => window.print();

  const handleArchive = () => {
    startTransition(async () => {
      const fd = new FormData();
      fd.set("invoice_id", String(invoiceId));
      fd.set("branch_id", branchId);
      const result = await archiveInvoice(fd);
      
      if (result?.error) {
        alert(`Archive Failed: ${result.error}`);
      }
    });
  };

  return (
    <div className="flex items-center justify-between w-full bg-white rounded-[2.5rem] p-4 border border-gray-100 shadow-sm print:hidden">
      <div className="flex items-center gap-3">
        <button
          onClick={handlePrint}
          className="flex items-center gap-3 px-8 py-4 bg-gray-50 text-[#052e36] rounded-2xl text-sm font-black hover:bg-gray-100 transition-all border border-gray-100 active:scale-95 shadow-sm"
        >
          <Printer className="w-5 h-5" />
          Print Document
        </button>

        <button
          onClick={handleArchive}
          disabled={isPending}
          className="flex items-center gap-3 px-8 py-4 bg-[#2563eb] text-white rounded-2xl text-sm font-black hover:bg-[#1d4ed8] transition-all disabled:opacity-60 shadow-lg shadow-blue-200 active:scale-95"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Box className="w-5 h-5" />
          )}
          {isPending ? "Archiving..." : "Archive Invoice ✨"}
        </button>
      </div>

      <div className="flex flex-col items-end px-6">
        <span className="text-[10px] font-black text-gray-300 tracking-[.3em] uppercase leading-none mb-1">Document Review</span>
        <span className="font-black text-[#052e36] text-sm uppercase tracking-tight leading-none">{branchName}</span>
      </div>
    </div>
  );
}
