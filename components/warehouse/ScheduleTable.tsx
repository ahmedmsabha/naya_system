"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resetDistributions, setDistributionQuantity } from "@/app/(dashboard)/branch/[id]/warehouse/actions";
import { type DateKeyedQuantities } from "@/lib/warehouse/date-keyed-quantities";
import { formatNumberEn } from "@/lib/format/en";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

function dmLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

interface ScheduleItem {
  ingredient_id: string;
  ingredient_name: string;
  unit_cost: number;
}

function buildWeekInventoryByDate(
  inventoryByDate: DateKeyedQuantities,
  weekDates: Record<string, string>
): DateKeyedQuantities {
  const m: DateKeyedQuantities = {};
  for (const dateIso of Object.values(weekDates)) {
    if (!inventoryByDate[dateIso]) continue;
    m[dateIso] = { ...inventoryByDate[dateIso] };
  }
  return m;
}

export function ScheduleTable({
  items,
  branchId,
  selectedDateIso,
  weekDates,
  inventoryByDate,
}: {
  items: ScheduleItem[];
  branchId: string;
  selectedDateIso: string;
  weekDates: Record<string, string>;
  inventoryByDate: DateKeyedQuantities;
}) {
  const router = useRouter();
  const [weekInventoryByDate, setWeekInventoryByDate] = useState(() =>
    buildWeekInventoryByDate(inventoryByDate, weekDates)
  );
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isPendingReset, startResetTransition] = useTransition();
  const debouncers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  useEffect(() => {
    const activeDebouncers = debouncers.current;
    return () => {
      for (const t of Object.values(activeDebouncers)) clearTimeout(t);
    };
  }, []);

  const rowMeta = useMemo(
    () =>
      items.map((it) => ({
        ingredient_id: it.ingredient_id,
        ingredient_name: it.ingredient_name,
        unit_cost: it.unit_cost,
      })),
    [items]
  );

  const weekGrandTotalPrice = useMemo(() => {
    return rowMeta.reduce((sum, item) => {
      const rowQty = DAYS.reduce(
        (qtySum, day) => qtySum + (weekInventoryByDate[weekDates[day]]?.[item.ingredient_id] || 0),
        0
      );
      return sum + rowQty * item.unit_cost;
    }, 0);
  }, [rowMeta, weekDates, weekInventoryByDate]);

  const setCell = (ingredientId: string, dateIso: string, qty: number) => {
    setWeekInventoryByDate((prev) => {
      const day = { ...(prev[dateIso] ?? {}) };
      if (qty <= 0) delete day[ingredientId];
      else day[ingredientId] = qty;
      const next = { ...prev };
      if (Object.keys(day).length === 0) delete next[dateIso];
      else next[dateIso] = day;
      return next;
    });
  };

  const persistCell = (ingredientId: string, day: string, dateIso: string, qty: number) => {
    const cellKey = `${ingredientId}-${day}`;
    setPendingCell(cellKey);
    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("ingredient_id", ingredientId);
    fd.set("date", dateIso);
    fd.set("quantity", String(qty));

    startTransition(async () => {
      const res = await setDistributionQuantity(fd);
      setPendingCell(null);
      if (res?.error) {
        alert(res.error);
        router.refresh();
      }
    });
  };

  const queuePersist = (ingredientId: string, day: string, dateIso: string, qty: number) => {
    const k = `${ingredientId}-${dateIso}`;
    const prevTimer = debouncers.current[k];
    if (prevTimer) clearTimeout(prevTimer);
    debouncers.current[k] = setTimeout(() => {
      delete debouncers.current[k];
      persistCell(ingredientId, day, dateIso, qty);
    }, 400);
  };

  const handleInputChange = (ingredientId: string, day: string, dateIso: string, raw: string) => {
    const qty = Math.max(0, Number(raw) || 0);
    setCell(ingredientId, dateIso, qty);
    queuePersist(ingredientId, day, dateIso, qty);
  };

  const handleReset = () => {
    const dates = Object.values(weekDates);
    if (!dates.length) return;
    const sorted = [...dates].sort();
    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("week_start", sorted[0]);
    fd.set("week_end", sorted[sorted.length - 1]);
    startResetTransition(async () => {
      const res = await resetDistributions(fd);
      if (res?.error) alert(res.error);
      setWeekInventoryByDate({});
      router.refresh();
    });
  };

  return (
    <div dir="ltr">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={handleReset}
          disabled={isPendingReset}
          className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 flex items-center gap-1 uppercase"
        >
          🗑 Clear week data
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="w-full text-sm border-collapse min-w-[880px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 tracking-wider min-w-[140px] uppercase">
                Item
              </th>
              <th className="px-3 py-3 text-[11px] font-bold text-gray-500 tracking-wider min-w-[88px] text-right uppercase">
                $ / unit
              </th>
              {DAYS.map((day) => {
                const iso = weekDates[day];
                const isSelectedDate = iso === selectedDateIso;
                return (
                  <th
                    key={day}
                    className={`px-2 py-3 text-[11px] font-bold tracking-wider min-w-[76px] uppercase text-center ${
                      isSelectedDate ? "text-[#2563eb]" : "text-gray-500"
                    }`}
                  >
                    <div>{day.slice(0, 3)}</div>
                    <div className="text-[10px] font-black text-[#2563eb] normal-case tracking-tight mt-0.5">
                      {dmLabel(iso)}
                    </div>
                    <div className="text-[9px] font-medium text-gray-400 font-mono mt-0.5">{iso}</div>
                  </th>
                );
              })}
              <th className="px-3 py-3 text-[11px] font-bold text-[#2563eb] tracking-wider uppercase text-center min-w-[100px]">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rowMeta.map((item) => {
              const rowTotalQty = DAYS.reduce(
                (sum, day) => sum + (weekInventoryByDate[weekDates[day]]?.[item.ingredient_id] || 0),
                0
              );
              const rowTotalPrice = rowTotalQty * item.unit_cost;
              return (
                <tr key={item.ingredient_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-[#052e36] text-left text-sm">
                    {item.ingredient_name}
                  </td>
                  <td className="px-3 py-3 text-right font-bold text-gray-600 tabular-nums">
                    ${formatNumberEn(item.unit_cost, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                  </td>
                  {DAYS.map((day) => {
                    const date = weekDates[day];
                    const cellKey = `${item.ingredient_id}-${day}`;
                    const isPending = pendingCell === cellKey;
                    const val = weekInventoryByDate[date]?.[item.ingredient_id] || 0;
                    return (
                      <td key={day} className="px-2 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          value={val === 0 ? "" : val}
                          placeholder="0"
                          disabled={isPending}
                          onChange={(e) =>
                            handleInputChange(item.ingredient_id, day, date, e.target.value)
                          }
                          className={`w-14 text-center py-1 rounded-lg border text-sm font-medium transition-colors focus:outline-none focus:border-[#2563eb] ${
                            isPending
                              ? "border-blue-200 text-blue-400"
                              : val > 0
                              ? "border-gray-200 text-[#2563eb] font-bold"
                              : "border-transparent text-gray-400"
                          } bg-transparent`}
                        />
                      </td>
                    );
                  })}
                  <td className="px-3 py-3 text-center font-black text-[#052e36]">
                    <div className="text-base text-[#2563eb] tabular-nums">{rowTotalQty}</div>
                    <div className="text-[11px] font-bold text-gray-500 mt-1 tabular-nums">
                      ${formatNumberEn(rowTotalPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t border-gray-100 bg-gray-50/40">
              <td className="px-4 py-4 text-left text-[11px] font-black text-gray-500 uppercase tracking-wider">
                Week total price
              </td>
              <td colSpan={8} />
              <td className="px-3 py-4 text-center font-black text-[#052e36]">
                ${formatNumberEn(weekGrandTotalPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
