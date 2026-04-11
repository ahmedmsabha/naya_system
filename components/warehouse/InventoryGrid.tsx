"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { deleteInventoryItem, setDistributionQuantity } from "@/app/(dashboard)/branch/[id]/warehouse/actions";
import { Trash2 } from "lucide-react";

export interface InventoryItem {
  id: string;
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  quantity_on_hand: number;
  unit_cost: number;
}

export function InventoryGrid({
  items,
  branchId,
  multiplier = 1,
  purchaseDateIso,
  getDayQty,
  patchDateQty,
}: {
  items: InventoryItem[];
  branchId: string;
  multiplier?: number;
  purchaseDateIso: string;
  getDayQty: (ingredientId: string) => number;
  patchDateQty: (dateIso: string, ingredientId: string, qty: number) => void;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <InventoryCard
          key={item.id}
          item={item}
          branchId={branchId}
          multiplier={multiplier}
          purchaseDateIso={purchaseDateIso}
          dayQty={getDayQty(item.ingredient_id)}
          patchDateQty={patchDateQty}
        />
      ))}
    </div>
  );
}

function InventoryCard({
  item,
  branchId,
  multiplier,
  purchaseDateIso,
  dayQty,
  patchDateQty,
}: {
  item: InventoryItem;
  branchId: string;
  multiplier: number;
  purchaseDateIso: string;
  dayQty: number;
  patchDateQty: (dateIso: string, ingredientId: string, qty: number) => void;
}) {
  const [tempQty, setTempQty] = useState(dayQty);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const batchStartQty = useRef<number | null>(null);
  const router = useRouter();

  useEffect(() => {
    setTempQty(dayQty);
  }, [dayQty, purchaseDateIso, item.ingredient_id]);

  const flushSave = (finalQty: number) => {
    const rollbackQty = batchStartQty.current ?? dayQty;
    batchStartQty.current = null;

    setIsSyncing(true);

    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("ingredient_id", item.ingredient_id);
    fd.set("date", purchaseDateIso);
    fd.set("quantity", String(finalQty));

    void (async () => {
      try {
        const res = await setDistributionQuantity(fd);
        if (res?.error) {
          patchDateQty(purchaseDateIso, item.ingredient_id, rollbackQty);
          setTempQty(rollbackQty);
          alert(res.error);
        }
      } finally {
        setIsSyncing(false);
      }
    })();
  };

  const scheduleFlush = (nextQty: number) => {
    if (batchStartQty.current === null) {
      batchStartQty.current = tempQty;
    }
    patchDateQty(purchaseDateIso, item.ingredient_id, nextQty);
    setTempQty(nextQty);

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      flushSave(nextQty);
    }, 450);
  };

  const handleDelta = (sign: 1 | -1) => {
    const delta = sign * multiplier;
    const nextQty = Math.max(0, tempQty + delta);
    scheduleFlush(nextQty);
  };

  const handleDelete = async () => {
    const ok = window.confirm(`Delete "${item.ingredient_name}" from this branch?`);
    if (!ok) return;
    setIsDeleting(true);
    try {
      const fd = new FormData();
      fd.set("inventory_id", item.id);
      fd.set("branch_id", branchId);
      const res = await deleteInventoryItem(fd);
      if (res?.error) alert(res.error);
      else router.refresh();
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-gray-100 p-6 flex flex-col gap-4 transition-all hover:shadow-sm ${
        isSyncing ? "ring-1 ring-[#2563eb]/20" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
          {item.unit === "UNIT" ? "BUCKET" : item.unit}
        </span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDelete}
            disabled={isDeleting || isSyncing}
            className="w-9 h-9 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-red-50 hover:border-red-100 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-50"
            aria-label="Delete item"
            title="Delete item"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          {(isSyncing || isDeleting) && (
            <span className="w-1.5 h-1.5 bg-[#2563eb] rounded-full animate-pulse" />
          )}
        </div>
      </div>

      <h3 className="font-bold text-[#052e36] text-lg leading-tight mt-1 mb-1">{item.ingredient_name}</h3>
      <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
        On hand: <span className="text-[#052e36]">{item.quantity_on_hand}</span>
      </p>

      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
        <button
          type="button"
          onClick={() => handleDelta(-1)}
          disabled={tempQty <= 0}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-[#2563eb] rounded-full disabled:opacity-30 transition-colors text-2xl font-medium"
          aria-label="Decrease"
        >
          −
        </button>
        <div className="flex flex-col items-center">
          <span className="text-[#2563eb] font-black text-2xl">{tempQty}</span>
          <span className="text-[9px] font-black text-gray-300 tracking-widest uppercase mt-0.5">this day</span>
        </div>
        <button
          type="button"
          onClick={() => handleDelta(1)}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-[#2563eb] rounded-full transition-colors text-2xl font-medium"
          aria-label="Increase"
        >
          +
        </button>
      </div>
    </div>
  );
}
