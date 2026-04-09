import { useEffect, useRef, useState } from "react";
import { setQuantity } from "@/app/(dashboard)/branch/[id]/warehouse/actions";

interface InventoryItem {
  id: string; // inventory row id
  ingredient_id: string;
  ingredient_name: string;
  unit: string;
  quantity_on_hand: number;
}

export function InventoryGrid({
  items,
  branchId,
  multiplier = 1,
}: {
  items: InventoryItem[];
  branchId: string;
  multiplier?: number;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      {items.map((item) => (
        <InventoryCard 
          key={item.id} 
          item={item} 
          branchId={branchId} 
          multiplier={multiplier} 
        />
      ))}
    </div>
  );
}

function InventoryCard({
  item,
  branchId,
  multiplier,
}: {
  item: InventoryItem;
  branchId: string;
  multiplier: number;
}) {
  // Local state for instant UI update
  const [tempQty, setTempQty] = useState(item.quantity_on_hand);
  const [isSyncing, setIsSyncing] = useState(false);
  const debounceTimer = useRef<NodeJS.Timeout | null>(null);

  // Sync local state when prop changes (e.g. after successful server revalidation)
  useEffect(() => {
    setTempQty(item.quantity_on_hand);
  }, [item.quantity_on_hand]);

  const syncWithServer = (finalQty: number) => {
    setIsSyncing(true);
    const fd = new FormData();
    fd.set("inventory_id", item.id);
    fd.set("branch_id", branchId);
    fd.set("quantity", String(finalQty));
    
    // We don't await here in the loop, just fire it off
    setQuantity(fd).finally(() => {
      setIsSyncing(false);
    });
  };

  const handleDelta = (sign: 1 | -1) => {
    const delta = sign * multiplier;
    const nextQty = Math.max(0, tempQty + delta);
    
    // Update UI instantly
    setTempQty(nextQty);

    // Clear existing timer and set a new one
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    
    debounceTimer.current = setTimeout(() => {
      syncWithServer(nextQty);
    }, 600); // 600ms delay after last click
  };

  return (
    <div
      className={`bg-white rounded-3xl border border-gray-100 p-6 flex flex-col gap-4 transition-all hover:shadow-sm ${
        isSyncing ? "ring-1 ring-[#2563eb]/20" : ""
      }`}
    >
      {/* Category label */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold tracking-widest text-gray-400 uppercase">
          {item.unit === 'UNIT' ? 'BUCKET' : item.unit}
        </span>
        {isSyncing && (
          <span className="w-1.5 h-1.5 bg-[#2563eb] rounded-full animate-pulse" />
        )}
      </div>

      {/* Item name */}
      <h3 className="font-bold text-[#052e36] text-lg leading-tight mt-1 mb-4">{item.ingredient_name}</h3>

      {/* Quantity + controls */}
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
        <button
          onClick={() => handleDelta(-1)}
          disabled={tempQty <= 0}
          className="w-10 h-10 flex items-center justify-center text-gray-400 hover:bg-gray-50 hover:text-[#2563eb] rounded-full disabled:opacity-30 transition-colors text-2xl font-medium"
          aria-label="Decrease"
        >
          −
        </button>
        <span className="text-[#2563eb] font-black text-2xl">
          {tempQty}
        </span>
        <button
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
