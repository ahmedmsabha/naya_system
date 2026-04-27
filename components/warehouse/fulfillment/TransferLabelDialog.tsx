"use client";

import { useRef } from "react";
import { QRCodeSVG } from "qrcode.react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { formatDateTimeEn } from "@/lib/format/en";
import { Printer } from "lucide-react";

export type LabelItem = {
  name: string;
  unit: string;
  quantity: number;
};

export function TransferLabelDialog({
  transferId,
  destinationName,
  dispatchedAtIso,
  items,
  trigger,
}: {
  transferId: string;
  destinationName: string;
  dispatchedAtIso: string | null;
  items: LabelItem[];
  trigger: React.ReactNode;
}) {
  const printRef = useRef<HTMLDivElement>(null);

  const printedAt = dispatchedAtIso
    ? formatDateTimeEn(dispatchedAtIso, { dateStyle: "medium", timeStyle: "short" })
    : "—";

  const print = () => {
    const el = printRef.current;
    if (!el) return;

    // Hidden iframe avoids pop-up blockers; waiting on afterprint fixes closing
    // a new window before the print dialog (which breaks many browsers).
    const docHtml = `<!DOCTYPE html><html><head><title>Transfer ${transferId}</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 24px; color: #052e36; }
        h1 { font-size: 18px; margin: 0 0 8px; }
        p { margin: 4px 0; font-size: 13px; }
        table { width: 100%; border-collapse: collapse; margin-top: 16px; font-size: 13px; }
        th, td { text-align: left; padding: 8px; border-bottom: 1px solid #e5e7eb; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style></head><body>${el.innerHTML}</body></html>`;

    const iframe = document.createElement("iframe");
    iframe.setAttribute("aria-hidden", "true");
    Object.assign(iframe.style, {
      position: "fixed",
      right: "0",
      bottom: "0",
      width: "0",
      height: "0",
      border: "0",
      opacity: "0",
      pointerEvents: "none",
    });
    document.body.appendChild(iframe);

    const w = iframe.contentWindow;
    const d = iframe.contentDocument;
    if (!w || !d) {
      iframe.remove();
      return;
    }

    d.open();
    d.write(docHtml);
    d.close();

    const cleanup = () => {
      try {
        iframe.remove();
      } catch {
        /* ignore */
      }
    };

    const runPrint = () => {
      w.focus();
      w.addEventListener("afterprint", cleanup, { once: true });
      w.print();
      // Some browsers omit afterprint; avoid an orphan iframe if the user leaves the tab.
      setTimeout(() => {
        if (iframe.isConnected) cleanup();
      }, 60_000);
    };

    // Two rAFs gives the document (including inline SVG) a paint cycle before print.
    requestAnimationFrame(() => {
      requestAnimationFrame(runPrint);
    });
  };

  return (
    <Dialog>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md print:max-w-none print:shadow-none print:border-0">
        <DialogHeader>
          <DialogTitle className="text-[#052e36]">Shipment label</DialogTitle>
        </DialogHeader>

        <div ref={printRef} className="space-y-4 print:p-0" id="transfer-label-print-root">
          <div className="flex flex-col sm:flex-row gap-6 items-start">
            <div className="shrink-0 bg-white p-2 rounded-2xl border border-slate-100 mx-auto sm:mx-0">
              <QRCodeSVG value={transferId} size={160} level="M" includeMargin />
            </div>
            <div className="flex-1 min-w-0 space-y-2 text-sm">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Transfer ID</p>
              <p className="font-mono text-xs break-all text-slate-700">{transferId}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-2">Destination</p>
              <p className="font-black text-[#052e36]">{destinationName}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 pt-2">Dispatch</p>
              <p className="font-bold text-slate-800">{printedAt}</p>
            </div>
          </div>

          <div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-2">Items</p>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-slate-500 text-xs uppercase tracking-wider">
                  <th className="py-2 pr-2">Ingredient</th>
                  <th className="py-2 pr-2">Unit</th>
                  <th className="py-2 text-right w-24">Qty sent</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row, i) => (
                  <tr key={`${row.name}-${i}`} className="border-b border-slate-100">
                    <td className="py-2 pr-2 font-medium text-[#052e36]">{row.name}</td>
                    <td className="py-2 pr-2 text-slate-500">{row.unit}</td>
                    <td className="py-2 text-right font-mono tabular-nums">{row.quantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <DialogFooter className="print:hidden gap-2 sm:gap-0">
          <button
            type="button"
            onClick={print}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#052e36] px-5 py-2.5 text-sm font-black text-white uppercase tracking-widest hover:bg-[#06434f]"
          >
            <Printer className="w-4 h-4" />
            Print label
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
