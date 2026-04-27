"use client";

import { useState, useTransition } from "react";
import { dispatchTransfer } from "@/app/(dashboard)/branch/[id]/warehouse/fulfillment/actions";
import { formatDateTimeEn, formatNumberEn } from "@/lib/format/en";
import { Package, Send, Tag } from "lucide-react";
import { TransferLabelDialog } from "./TransferLabelDialog";

export type FulfillmentOrderRow = {
  id: string;
  status: "pending" | "in_transit";
  createdAt: string;
  dispatchedAt: string | null;
  destinationName: string;
  items: { name: string; unit: string; quantity: number }[];
};

export function FulfillmentOrderList({
  commissaryBranchId,
  orders,
  canDispatch,
}: {
  commissaryBranchId: string;
  orders: FulfillmentOrderRow[];
  canDispatch: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="space-y-4">
      {error && (
        <p className="text-sm text-red-900 bg-red-50 border border-red-100 rounded-2xl px-4 py-3" role="alert">
          {error}
        </p>
      )}

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-slate-200 bg-slate-50/80 py-16 px-6 text-center">
          <Package className="w-10 h-10 text-slate-300" />
          <p className="text-sm font-bold text-slate-600">No pending or in-transit transfers from this commissary.</p>
          <p className="text-xs text-slate-400">New branch orders will appear here when their status is pending.</p>
        </div>
      ) : (
        <ul className="flex flex-col gap-4">
          {orders.map((order) => (
            <li
              key={order.id}
              className="rounded-3xl border border-slate-100 bg-white p-5 shadow-sm flex flex-col gap-4 md:flex-row md:items-start md:justify-between"
            >
              <div className="min-w-0 flex-1 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={
                      order.status === "pending"
                        ? "inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-amber-900"
                        : "inline-flex items-center rounded-full bg-sky-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-sky-900"
                    }
                  >
                    {order.status === "pending" ? "Pending" : "In transit"}
                  </span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                    {formatDateTimeEn(order.createdAt, { dateStyle: "medium", timeStyle: "short" })}
                  </span>
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Destination</p>
                  <p className="text-lg font-black text-[#052e36]">{order.destinationName}</p>
                </div>
                <div className="overflow-x-auto rounded-2xl border border-slate-100">
                  <table className="w-full min-w-[280px] text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-slate-500 text-[10px] uppercase tracking-wider">
                        <th className="py-2 px-3">Item</th>
                        <th className="py-2 px-3">Unit</th>
                        <th className="py-2 px-3 text-right">Qty</th>
                      </tr>
                    </thead>
                    <tbody>
                      {order.items.map((it, idx) => (
                        <tr key={`${order.id}-${idx}`} className="border-t border-slate-100">
                          <td className="py-2 px-3 font-medium text-[#052e36]">{it.name}</td>
                          <td className="py-2 px-3 text-slate-500">{it.unit}</td>
                          <td className="py-2 px-3 text-right font-mono tabular-nums">
                            {formatNumberEn(it.quantity, { maximumFractionDigits: 3 })}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex flex-col gap-2 shrink-0 md:items-end">
                {order.status === "pending" && (
                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      setError(null);
                      const fd = new FormData(e.currentTarget);
                      startTransition(async () => {
                        const res = await dispatchTransfer(fd);
                        if ("error" in res) setError(res.error);
                      });
                    }}
                  >
                    <input type="hidden" name="transfer_id" value={order.id} />
                    <input type="hidden" name="commissary_branch_id" value={commissaryBranchId} />
                    <button
                      type="submit"
                      disabled={!canDispatch || isPending}
                      className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-2xl bg-[#2563eb] px-5 py-3 text-xs font-black uppercase tracking-widest text-white shadow-lg shadow-blue-200/40 hover:bg-blue-600 disabled:opacity-40 disabled:pointer-events-none"
                    >
                      <Send className="w-4 h-4" />
                      {isPending ? "Dispatching…" : "Dispatch shipment"}
                    </button>
                  </form>
                )}
                {order.status === "in_transit" && (
                  <TransferLabelDialog
                    transferId={order.id}
                    destinationName={order.destinationName}
                    dispatchedAtIso={order.dispatchedAt}
                    items={order.items}
                    trigger={
                      <button
                        type="button"
                        className="inline-flex w-full md:w-auto items-center justify-center gap-2 rounded-2xl border-2 border-[#052e36] bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-[#052e36] hover:bg-[#052e36]/5"
                      >
                        <Tag className="w-4 h-4" />
                        Print label
                      </button>
                    }
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
