"use client";

import { useMemo, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { InventoryGrid, type InventoryItem } from "./InventoryGrid";
import { Loader2, Search } from "lucide-react";
import {
  cloneDateKeyedQuantities,
  type DateKeyedQuantities,
} from "@/lib/warehouse/date-keyed-quantities";
import { formatNumberEn } from "@/lib/format/en";
import type { WeekdayKey } from "@/lib/warehouse/week-dates";

const UI_DAYS = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;

export function InventoryView({
  items,
  branchId,
  purchaseDateIso,
  weekDates,
  inventoryByDate,
}: {
  items: InventoryItem[];
  branchId: string;
  purchaseDateIso: string;
  weekDates: Record<WeekdayKey, string>;
  inventoryByDate: DateKeyedQuantities;
}) {
  const router = useRouter();
  const [isNavigating, startNavigating] = useTransition();
  const [multiplier, setMultiplier] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const multipliers = [1, 5, 10, 20];

  const shortToLong: Record<(typeof UI_DAYS)[number], WeekdayKey> = {
    SUN: "SUNDAY",
    MON: "MONDAY",
    TUE: "TUESDAY",
    WED: "WEDNESDAY",
    THU: "THURSDAY",
    FRI: "FRIDAY",
    SAT: "SATURDAY",
  };

  const [localInventoryByDate, setLocalInventoryByDate] = useState(() => cloneDateKeyedQuantities(inventoryByDate));

  const patchDateQty = (dateIso: string, ingredientId: string, qty: number) => {
    setLocalInventoryByDate((prev) => {
      const row = { ...(prev[dateIso] ?? {}) };
      if (qty <= 0) delete row[ingredientId];
      else row[ingredientId] = qty;
      const next = { ...prev };
      if (Object.keys(row).length === 0) delete next[dateIso];
      else next[dateIso] = row;
      return next;
    });
  };

  const anchorDay = new Date(`${purchaseDateIso}T12:00:00`);
  const activePill = UI_DAYS[Number.isNaN(anchorDay.getTime()) ? 0 : anchorDay.getDay()];

  const goToDate = (iso: string) => {
    startNavigating(() => {
      router.push(`/branch/${branchId}/warehouse?date=${iso}`);
    });
  };

  const unitCostById = useMemo(() => {
    const m: Record<string, number> = {};
    for (const it of items) m[it.ingredient_id] = it.unit_cost;
    return m;
  }, [items]);

  const dayTotal = useMemo(() => {
    let sum = 0;
    for (const [ing, qty] of Object.entries(localInventoryByDate[purchaseDateIso] ?? {})) {
      sum += qty * (unitCostById[ing] ?? 0);
    }
    return sum;
  }, [localInventoryByDate, purchaseDateIso, unitCostById]);

  const filteredItems = items.filter((item) =>
    item.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dayDetails = filteredItems
    .map((item) => {
      const qty = Number(localInventoryByDate[purchaseDateIso]?.[item.ingredient_id] ?? 0);
      return { ingredient_id: item.ingredient_id, name: item.ingredient_name, unit: item.unit, qty };
    })
    .filter((x) => x.qty > 0)
    .sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="flex flex-col gap-6 md:gap-8 w-full max-w-full overflow-hidden" dir="ltr">
      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#2563eb] transition-colors" />
        <input
          type="text"
          placeholder="Search inventory items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-[2rem] py-4 md:py-5 pl-12 md:pl-14 pr-5 md:pr-8 text-base md:text-lg font-medium shadow-sm focus:outline-none focus:ring-4 focus:ring-[#2563eb]/5 focus:border-[#2563eb]/20 transition-all placeholder:text-gray-300"
        />
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="flex flex-col sm:flex-row sm:flex-wrap sm:items-center gap-3 min-w-0">
            <label className="flex items-center gap-2 bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm">
              <span className="text-[10px] font-black text-gray-400 tracking-widest uppercase whitespace-nowrap">
                Date
              </span>
              <input
                type="date"
                value={purchaseDateIso}
                disabled={isNavigating}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v) goToDate(v);
                }}
                className="text-sm font-black text-[#052e36] bg-transparent border-0 focus:ring-0 cursor-pointer"
              />
              {isNavigating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563eb]" /> : null}
            </label>
            <Link
              href={`/branch/${branchId}/warehouse/schedule?date=${purchaseDateIso}`}
              className="text-[11px] font-black text-[#2563eb] hover:underline uppercase tracking-wide whitespace-nowrap"
            >
              Schedule · same week
            </Link>
            <Link
              href={`/branch/${branchId}/warehouse/invoice?date=${purchaseDateIso}`}
              className="text-[11px] font-black text-amber-600 hover:underline uppercase tracking-wide whitespace-nowrap"
            >
              Invoice · this day
            </Link>

            <div className="flex items-center gap-1.5 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto max-w-full">
              {UI_DAYS.map((d) => {
                const isoForPill = weekDates[shortToLong[d]];
                const isActive = isoForPill === purchaseDateIso;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={isNavigating}
                    onClick={() => goToDate(isoForPill)}
                    className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap active:scale-[.98] ${
                      isActive
                        ? "bg-[#2563eb] text-white shadow-lg shadow-blue-200"
                        : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                    } ${isNavigating ? "opacity-70 cursor-wait" : ""}`}
                  >
                    {d}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex items-center justify-between sm:justify-start gap-3 sm:gap-4 bg-[#052e36] p-2 rounded-2xl shadow-lg w-full sm:w-auto">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">
              Multiplier
            </span>
            <div className="flex items-center gap-2">
              {multipliers.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMultiplier(m)}
                  className={`w-9 h-9 rounded-xl flex items-center justify-center text-xs font-black transition-all ${
                    multiplier === m
                      ? "bg-[#2563eb] text-white scale-110 shadow-lg"
                      : "bg-white/5 text-gray-300 hover:bg-white/10"
                  }`}
                >
                  {m}+
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Day summary + live total */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm px-4 sm:px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-300 tracking-[.25em] uppercase">
                {activePill} · {purchaseDateIso}
              </span>
              <span className="text-sm font-black text-[#052e36] tracking-tight mt-1">
                {dayDetails.length ? `${dayDetails.length} item${dayDetails.length === 1 ? "" : "s"} purchased` : "No purchases yet"}
              </span>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="text-[10px] font-black text-gray-300 tracking-widest uppercase">Day total</span>
              <span className="text-xl sm:text-2xl font-black text-[#2563eb] tabular-nums">
                ${formatNumberEn(dayTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {dayDetails.length ? (
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {dayDetails.slice(0, 12).map((d) => (
                <div
                  key={d.ingredient_id}
                  className="rounded-2xl border border-gray-100 bg-gray-50/40 px-4 py-3 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <div className="text-[11px] font-black text-[#052e36] truncate">{d.name}</div>
                    <div className="text-[10px] font-bold text-gray-400 tracking-widest uppercase mt-1">
                      {d.unit === "UNIT" ? "BUCKET" : d.unit}
                    </div>
                  </div>
                  <div className={`font-black text-lg ${d.qty > 0 ? "text-[#2563eb]" : "text-gray-300"}`}>{d.qty}</div>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-2">
          <div className="flex items-start sm:items-center gap-3">
            <div className="w-10 h-10 bg-[#eef5fe] rounded-full flex items-center justify-center border border-blue-50">
              <span className="text-[#2563eb] text-xl font-bold">+</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-[#052e36] tracking-[.2em] uppercase leading-none">
                Day purchases
              </span>
              <span className="text-[11px] text-gray-400 font-medium mt-1">
                {isNavigating ? (
                  <span className="inline-flex items-center gap-1.5 text-[#2563eb]">
                    <Loader2 className="w-3 h-3 animate-spin" />
                    Loading {purchaseDateIso}...
                  </span>
                ) : (
                  <>
                    Saving to <span className="font-black text-[#2563eb]">{purchaseDateIso}</span>. Step: {multiplier}
                  </>
                )}
              </span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="hidden sm:block h-px w-24 bg-gray-100" />
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">
              {filteredItems.length} Products Found
            </span>
          </div>
        </div>
      </div>

      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-gray-50/50 rounded-[3rem] border border-gray-100 border-dashed">
          <p className="text-gray-300 text-5xl mb-6">🔍</p>
          <p className="text-gray-600 text-xl font-bold">No results found</p>
          <p className="text-gray-400 text-sm mt-2 max-w-xs">
            We couldn&apos;t find anything matching &quot;{searchQuery}&quot;.
          </p>
        </div>
      ) : (
        <InventoryGrid
          items={filteredItems}
          branchId={branchId}
          multiplier={multiplier}
          purchaseDateIso={purchaseDateIso}
          getDayQty={(ingredientId) => Number(localInventoryByDate[purchaseDateIso]?.[ingredientId] ?? 0) || 0}
          patchDateQty={patchDateQty}
        />
      )}
    </div>
  );
}
