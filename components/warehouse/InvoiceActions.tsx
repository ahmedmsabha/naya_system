"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Box, Loader2 } from "lucide-react";
import { archiveInvoice } from "@/app/(dashboard)/branch/[id]/warehouse/actions";

export function InvoiceActions({
  branchId,
  branchName,
  purchaseDateIso,
  hasItems,
}: {
  branchId: string;
  branchName: string;
  purchaseDateIso: string;
  hasItems: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [isDateNavigating, startDateNavigating] = useTransition();
  const router = useRouter();

  const handlePrint = () => window.print();
  const goToDate = (dateIso: string) => {
    startDateNavigating(() => {
      router.push(`/branch/${branchId}/warehouse/invoice?date=${dateIso}`);
    });
  };

  const handleArchive = () => {
    if (!hasItems) {
      alert("No purchases found for this date. Add quantities in Overview first.");
      return;
    }
    if (!confirm(`Archive purchases for ${purchaseDateIso}?\n\nThis snapshots today's baseline for invoice deltas.`)) {
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("branch_id", branchId);
      fd.set("purchase_date", purchaseDateIso);
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
          disabled={isPending || !hasItems}
          className="flex items-center gap-3 px-8 py-4 bg-[#2563eb] text-white rounded-2xl text-sm font-black hover:bg-[#1d4ed8] transition-all disabled:opacity-60 shadow-lg shadow-blue-200 active:scale-95"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Box className="w-5 h-5" />
          )}
          {isPending ? "Archiving..." : `Archive · ${purchaseDateIso}`}
        </button>
      </div>

      <div className="flex flex-col items-end px-6">
        <span className="text-[10px] font-black text-gray-300 tracking-[.3em] uppercase leading-none mb-1">
          Purchase Date
        </span>
        <input
          type="date"
          value={purchaseDateIso}
          disabled={isDateNavigating || isPending}
          onChange={(e) => {
            if (e.target.value) goToDate(e.target.value);
          }}
          className="font-black text-[#052e36] text-sm uppercase tracking-tight leading-none bg-transparent border border-gray-200 rounded-lg px-2 py-1"
        />
        <span className="text-[10px] font-bold text-gray-400 mt-1">
          {isDateNavigating ? (
            <span className="inline-flex items-center gap-1 text-[#2563eb]">
              <Loader2 className="w-3 h-3 animate-spin" />
              Loading...
            </span>
          ) : (
            branchName
          )}
        </span>
      </div>
    </div>
  );
}
