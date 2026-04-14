"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Printer, Box, Loader2 } from "lucide-react";
import { archiveWeeklyInvoice, upsertWeeklyInvoice } from "@/app/(dashboard)/branch/[id]/warehouse/actions";
import { generateWeeklyInvoicePdf, type WeeklyInvoicePdfInput } from "@/components/warehouse/weekly-invoice-pdf";

export function InvoiceActions({
  branchId,
  branchName,
  anchorDateIso,
  weekStartIso,
  weekEndIso,
  invoiceNumber,
  invoiceStatus,
  hasItems,
  pdfRows,
  grandTotal,
}: {
  branchId: string;
  branchName: string;
  anchorDateIso: string;
  weekStartIso: string;
  weekEndIso: string;
  invoiceNumber: string;
  invoiceStatus: string;
  hasItems: boolean;
  pdfRows: WeeklyInvoicePdfInput["rows"];
  grandTotal: number;
}) {
  const [isPending, startTransition] = useTransition();
  const [isDateNavigating, startDateNavigating] = useTransition();
  const router = useRouter();

  const formatLongDate = (iso: string) =>
    new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const handlePrint = () => {
    generateWeeklyInvoicePdf({
      branchName,
      invoiceNumber,
      weekStartLabel: formatLongDate(weekStartIso),
      weekEndLabel: formatLongDate(weekEndIso),
      rows: pdfRows,
      grandTotal,
    });
  };

  const goToDate = (dateIso: string) => {
    startDateNavigating(() => {
      router.push(`/branch/${branchId}/warehouse/invoice?date=${dateIso}`);
    });
  };

  const handleUpdateInvoice = () => {
    if (!hasItems) {
      alert("No purchases found for this week. Add quantities in Overview/Schedule first.");
      return;
    }
    if (
      !confirm(
        `Update weekly invoice for ${weekStartIso} to ${weekEndIso}?\n\nThis recalculates totals and refreshes invoice items.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("branch_id", branchId);
      fd.set("anchor_date", anchorDateIso);
      const result = await upsertWeeklyInvoice(fd);

      if (result?.error) {
        alert(`Update Failed: ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  const handleArchiveInvoice = () => {
    if (!hasItems) {
      alert("No purchases found for this week. Add quantities in Overview/Schedule first.");
      return;
    }
    if (
      !confirm(
        `Archive weekly invoice for ${weekStartIso} to ${weekEndIso}?\n\nYou can still edit it later using Update Archived Invoice.`
      )
    ) {
      return;
    }
    startTransition(async () => {
      const fd = new FormData();
      fd.set("branch_id", branchId);
      fd.set("anchor_date", anchorDateIso);
      const result = await archiveWeeklyInvoice(fd);
      if (result?.error) {
        alert(`Archive Failed: ${result.error}`);
        return;
      }
      router.refresh();
    });
  };

  return (
    <div className="flex items-center justify-between w-full bg-white rounded-[2.5rem] p-4 border border-gray-100 shadow-sm print:hidden">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
        <button
          onClick={handlePrint}
          className="flex items-center gap-3 px-8 py-4 bg-gray-50 text-[#052e36] rounded-2xl text-sm font-black hover:bg-gray-100 transition-all border border-gray-100 active:scale-95 shadow-sm"
        >
          <Printer className="w-5 h-5" />
          Print Document
        </button>

        {invoiceStatus !== "archived" ? (
          <button
            onClick={handleArchiveInvoice}
            disabled={isPending}
            className="flex items-center gap-3 px-8 py-4 bg-[#2563eb] text-white rounded-2xl text-sm font-black hover:bg-[#1d4ed8] transition-all disabled:opacity-60 shadow-lg shadow-blue-200 active:scale-95"
          >
            {isPending ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Box className="w-5 h-5" />
            )}
            {isPending ? "Archiving..." : "Archive Invoice"}
          </button>
        ) : null}

        <button
          onClick={handleUpdateInvoice}
          disabled={isPending}
          className="flex items-center gap-3 px-8 py-4 bg-slate-700 text-white rounded-2xl text-sm font-black hover:bg-slate-800 transition-all disabled:opacity-60 shadow-lg shadow-slate-200 active:scale-95"
        >
          {isPending ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Box className="w-5 h-5" />
          )}
          {isPending ? "Updating..." : invoiceStatus === "archived" ? "Update Archived Invoice" : "Update Invoice"}
        </button>
        </div>
        <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide px-1">
          Archived invoices stay editable and printable.
        </p>
      </div>

      <div className="flex flex-col items-end px-6">
        <span className="text-[10px] font-black text-gray-300 tracking-[.3em] uppercase leading-none mb-1">
          Anchor Date
        </span>
        <input
          type="date"
          value={anchorDateIso}
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
