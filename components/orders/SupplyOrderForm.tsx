"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { createSupplyOrder } from "@/app/(dashboard)/branch/[id]/orders/actions";
import { formatNumberEn } from "@/lib/format/en";
import { Calendar, FileText, Package, ScanLine, Send } from "lucide-react";

export type OrderIngredient = {
  id: string;
  name: string;
  unit: string;
  cost_per_unit: number;
};

export function SupplyOrderForm({
  branchId,
  branchName,
  branchLocation,
  ingredients,
  canSubmit,
  pendingTransferCount = 0,
  inTransitTransferCount = 0,
}: {
  branchId: string;
  branchName: string;
  branchLocation?: string | null;
  ingredients: OrderIngredient[];
  canSubmit: boolean;
  /** Transfers to this branch awaiting commissary dispatch */
  pendingTransferCount?: number;
  /** Shipments in transit to this branch */
  inTransitTransferCount?: number;
}) {
  const [qtyById, setQtyById] = useState<Record<string, string>>({});
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const [isPending, startTransition] = useTransition();

  const totalValue = useMemo(() => {
    let sum = 0;
    for (const ing of ingredients) {
      const raw = qtyById[ing.id];
      const n = raw === undefined || raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      sum += n * ing.cost_per_unit;
    }
    return sum;
  }, [ingredients, qtyById]);

  const onSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setMessage(null);
    if (!canSubmit) {
      setMessage({ type: "err", text: "You do not have permission to submit orders." });
      return;
    }
    const lines: { ingredient_id: string; quantity: number }[] = [];
    for (const ing of ingredients) {
      const raw = qtyById[ing.id];
      const n = raw === undefined || raw === "" ? 0 : Number(raw);
      if (!Number.isFinite(n) || n < 0) {
        setMessage({ type: "err", text: "Enter valid quantities (zero or positive numbers)." });
        return;
      }
      if (n > 0) {
        lines.push({ ingredient_id: ing.id, quantity: n });
      }
    }
    if (lines.length === 0) {
      setMessage({ type: "err", text: "Enter a requested quantity for at least one ingredient." });
      return;
    }

    const fd = new FormData(e.currentTarget);
    fd.set("to_branch_id", branchId);
    fd.set("lines_json", JSON.stringify(lines));

    startTransition(async () => {
      const res = await createSupplyOrder(fd, branchId);
      if ("error" in res) {
        setMessage({ type: "err", text: res.error });
        return;
      }
      setMessage({ type: "ok", text: "Order submitted. The commissary will see it as a pending transfer." });
      setQtyById({});
    });
  };

  if (ingredients.length === 0) {
    return (
      <p className="text-sm text-amber-800 bg-amber-50 border border-amber-100 rounded-2xl px-4 py-3">
        No ingredients are available yet. Add ingredients from the commissary warehouse first.
      </p>
    );
  }

  const today = new Date();
  const displayDate = today.toLocaleDateString("en-US", {
    month: "2-digit",
    day: "2-digit",
    year: "numeric",
  });

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-6 md:gap-8">
      <input type="hidden" name="to_branch_id" value={branchId} readOnly aria-hidden />

      {message && (
        <div
          role="status"
          className={
            message.type === "ok"
              ? "text-sm text-emerald-900 bg-emerald-50 border border-emerald-100 rounded-2xl px-4 py-3"
              : "text-sm text-red-900 bg-red-50 border border-red-100 rounded-2xl px-4 py-3"
          }
        >
          {message.text}
        </div>
      )}

      {/* Stats row — mirrors warehouse main page */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        <div className="bg-[#052e36] rounded-[2rem] px-6 md:px-8 py-6 shadow-xl shadow-teal-900/10 lg:col-span-3">
          <p className="text-[10px] font-black text-gray-400 tracking-[.2em] uppercase mb-2">Open requests</p>
          <div className="flex items-baseline gap-2 flex-wrap">
            <span className="text-4xl font-black text-white">{pendingTransferCount}</span>
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest">Pending</span>
            <span className="text-gray-500 text-[10px] font-bold ml-auto">+ {inTransitTransferCount} in transit</span>
          </div>
        </div>

        <div className="bg-[#2563eb] rounded-[2rem] px-6 md:px-10 py-8 shadow-2xl shadow-blue-200/40 relative overflow-hidden lg:col-span-6">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <p className="text-[11px] font-black text-blue-100 tracking-[.2em] uppercase mb-2">Cart total (estimate)</p>
          <p className="text-4xl md:text-5xl font-black text-white tracking-tighter break-all sm:break-normal">
            ${formatNumberEn(totalValue, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] font-bold text-blue-200 mt-2">Live — updates as you enter requested quantities</p>
        </div>

        <div className="bg-white rounded-[2rem] px-6 md:px-8 py-6 border border-gray-100 flex flex-col items-center justify-center shadow-sm gap-3 lg:col-span-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#2563eb]" />
            <span className="font-black text-[#052e36] text-xl tracking-tight">{displayDate}</span>
          </div>
          <Link
            href={`/branch/${branchId}/orders/scan`}
            className="inline-flex items-center gap-2 text-[11px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest whitespace-nowrap"
          >
            <ScanLine className="w-4 h-4" />
            Receive shipment
          </Link>
        </div>
      </div>

      {/* Main content — same rhythm as warehouse: grid + sticky column */}
      <div className="flex flex-col xl:flex-row gap-6 md:gap-10 items-start mt-2 md:mt-4">
        <div className="flex-1 min-w-0 w-full">
          <p className="text-[10px] font-black text-gray-400 tracking-widest uppercase mb-3">Ingredients (request qty)</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {ingredients.map((ing) => (
              <div
                key={ing.id}
                className="bg-white rounded-2xl border border-gray-100 p-4 shadow-sm flex flex-col gap-2 min-h-[9rem]"
              >
                <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">{ing.unit}</p>
                <p className="text-sm font-black text-[#052e36] leading-tight line-clamp-2">{ing.name}</p>
                <p className="text-xs text-gray-500">
                  ${formatNumberEn(ing.cost_per_unit, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}{" "}
                  <span className="text-gray-400">/ {ing.unit}</span>
                </p>
                <label className="mt-auto text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Requested qty
                  <input
                    type="number"
                    min={0}
                    step="any"
                    inputMode="decimal"
                    disabled={!canSubmit || isPending}
                    value={qtyById[ing.id] ?? ""}
                    onChange={(e) => {
                      const v = e.target.value;
                      setQtyById((prev) => ({ ...prev, [ing.id]: v }));
                    }}
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-bold text-[#052e36] focus:outline-none focus:ring-2 focus:ring-[#2563eb]/30 disabled:opacity-50"
                    placeholder="0"
                  />
                </label>
              </div>
            ))}
          </div>
        </div>

        <div className="w-full xl:w-80 shrink-0 xl:sticky xl:top-8 space-y-4">
          <div className="bg-[#052e36] rounded-[2rem] px-6 py-6 text-white shadow-xl shadow-teal-900/10">
            <p className="text-[10px] font-black text-gray-400 tracking-[.2em] uppercase mb-2">Ordering for</p>
            <p className="text-lg font-black tracking-tight">{branchName}</p>
            {branchLocation ? (
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">{branchLocation}</p>
            ) : null}
            <p className="text-[10px] text-gray-500 mt-3 leading-relaxed">
              Orders are sent to the commissary as a transfer in <span className="text-gray-300 font-bold">pending</span> status until
              they dispatch.
            </p>
          </div>
          <div className="rounded-2xl border border-gray-100 bg-gray-50/80 px-4 py-4 text-xs text-gray-600">
            <p className="font-black text-[#052e36] text-[10px] uppercase tracking-widest mb-2">Workflow</p>
            <ol className="list-decimal list-inside space-y-1.5 text-gray-600">
              <li>Enter quantities and submit your request.</li>
              <li>Commissary fulfills and dispatches the shipment.</li>
              <li>Scan the label QR to receive and update stock.</li>
            </ol>
            <Link
              href={`/branch/${branchId}/warehouse`}
              className="mt-3 inline-flex items-center gap-2 text-[11px] font-black text-[#2563eb] hover:text-blue-700 uppercase tracking-widest"
            >
              <FileText className="w-4 h-4" />
              Branch warehouse
            </Link>
          </div>
          <button
            type="submit"
            disabled={!canSubmit || isPending}
            className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#052e36] text-white font-black text-xs uppercase tracking-widest px-6 py-4 hover:bg-[#06434f] transition-colors disabled:opacity-40 disabled:pointer-events-none"
          >
            {isPending ? (
              "Submitting…"
            ) : (
              <>
                <Send className="w-4 h-4" />
                Submit order
              </>
            )}
          </button>
        </div>
      </div>
    </form>
  );
}

export function CommissaryOrderNotice() {
  return (
    <div className="flex items-start gap-3 bg-[#052e36]/5 border border-[#052e36]/10 rounded-2xl px-5 py-4 text-[#052e36]">
      <Package className="w-5 h-5 shrink-0 mt-0.5" />
      <div>
        <p className="text-sm font-black uppercase tracking-widest text-[#052e36]/80">Commissary branch</p>
        <p className="text-sm text-[#052e36]/80 mt-1">
          Supply orders are created by restaurant branches to request stock from the commissary. Go to a restaurant
          branch dashboard to build an order.
        </p>
      </div>
    </div>
  );
}
