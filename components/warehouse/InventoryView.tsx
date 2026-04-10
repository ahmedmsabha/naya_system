"use client";

import { useState } from "react";
import { InventoryGrid, type InventoryItem } from "./InventoryGrid";
import { Search } from "lucide-react";

type WeekdayKey = "MONDAY" | "TUESDAY" | "WEDNESDAY" | "THURSDAY" | "FRIDAY" | "SATURDAY" | "SUNDAY";

export function InventoryView({
  items,
  branchId,
  weekDates,
  distributionsByIngredient,
}: {
  items: InventoryItem[];
  branchId: string;
  weekDates: Record<WeekdayKey, string>;
  distributionsByIngredient: Record<string, Record<string, number>>;
}) {
  const [multiplier, setMultiplier] = useState<number>(1);
  const [searchQuery, setSearchQuery] = useState("");
  const multipliers = [1, 5, 10, 20];

  const today = new Date();
  const dayNames = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"] as const;
  const todayDay = dayNames[today.getDay()];
  const [selectedDay, setSelectedDay] = useState<(typeof dayNames)[number]>(todayDay);

  const shortToLong: Record<(typeof dayNames)[number], WeekdayKey> = {
    SUN: "SUNDAY",
    MON: "MONDAY",
    TUE: "TUESDAY",
    WED: "WEDNESDAY",
    THU: "THURSDAY",
    FRI: "FRIDAY",
    SAT: "SATURDAY",
  };

  const selectedDateIso = weekDates[shortToLong[selectedDay]];

  // Filter items based on search query
  const filteredItems = items.filter((item) =>
    item.ingredient_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const dayDetails = filteredItems
    .map((item) => {
      const qty = Number(distributionsByIngredient[item.ingredient_id]?.[selectedDateIso] ?? 0);
      return { ingredient_id: item.ingredient_id, name: item.ingredient_name, unit: item.unit, qty };
    })
    .filter((x) => x.qty > 0)
    .sort((a, b) => {
      if (b.qty !== a.qty) return b.qty - a.qty;
      return a.name.localeCompare(b.name);
    });

  return (
    <div className="flex flex-col gap-8 w-full max-w-full overflow-hidden" dir="ltr">
      {/* ─── ROW 1: SEARCH ────────────────────────────────────────── */}
      <div className="relative group">
        <Search className="absolute left-6 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 group-focus-within:text-[#2563eb] transition-colors" />
        <input
          type="text"
          placeholder="Search inventory items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full bg-white border border-gray-100 rounded-[2rem] py-5 pl-14 pr-8 text-lg font-medium shadow-sm focus:outline-none focus:ring-4 focus:ring-[#2563eb]/5 focus:border-[#2563eb]/20 transition-all placeholder:text-gray-300"
        />
      </div>

      <div className="flex flex-col gap-4">
        {/* ─── ROW 2: DAYS & MULTIPLIER ────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-1.5 bg-white p-2 rounded-2xl border border-gray-100 shadow-sm overflow-x-auto max-w-full">
            {dayNames.map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setSelectedDay(d)}
                className={`px-4 py-2 rounded-xl text-[10px] font-black tracking-widest transition-all whitespace-nowrap active:scale-[.98] ${
                  d === selectedDay
                    ? "bg-[#2563eb] text-white shadow-lg shadow-blue-200"
                    : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-4 bg-[#052e36] p-2 rounded-2xl shadow-lg">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-3">
              Multiplier
            </span>
            <div className="flex items-center gap-2">
              {multipliers.map((m) => (
                <button
                  key={m}
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

        {/* ─── Selected day details ─────────────────────────────── */}
        <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm px-6 py-5">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-gray-300 tracking-[.25em] uppercase">
                {selectedDay} details
              </span>
              <span className="text-sm font-black text-[#052e36] tracking-tight mt-1">
                {selectedDateIso}
              </span>
            </div>
            <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
              {dayDetails.length ? `Showing ${dayDetails.length} items` : "No purchases this day"}
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

        {/* ─── ROW 3: QUICK ADD STATUS ────────────────────────────── */}
        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#eef5fe] rounded-full flex items-center justify-center border border-blue-50">
              <span className="text-[#2563eb] text-xl font-bold">+</span>
            </div>
            <div className="flex flex-col">
              <span className="text-[10px] font-black text-[#052e36] tracking-[.2em] uppercase leading-none">Quick Add Active</span>
              <span className="text-[11px] text-gray-400 font-medium mt-1">Incrementing by {multiplier} units</span>
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

      {/* Grid */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-gray-50/50 rounded-[3rem] border border-gray-100 border-dashed">
          <p className="text-gray-300 text-5xl mb-6">🔍</p>
          <p className="text-gray-600 text-xl font-bold">No results found</p>
          <p className="text-gray-400 text-sm mt-2 max-w-xs">We couldn&apos;t find anything matching &quot;{searchQuery}&quot;. Try generic terms or add a new item.</p>
        </div>
      ) : (
        <InventoryGrid items={filteredItems} branchId={branchId} multiplier={multiplier} />
      )}
    </div>
  );
}
