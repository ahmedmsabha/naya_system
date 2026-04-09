"use client";

import { useState, useTransition } from "react";
import { upsertDistribution, resetDistributions } from "@/app/(dashboard)/branch/[id]/warehouse/actions";

const DAYS = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"] as const;

interface ScheduleItem {
  ingredient_id: string;
  ingredient_name: string;
  distributions: Record<string, number>; // date → quantity
  weekDates: Record<string, string>; // day name → ISO date
}

export function ScheduleTable({
  items,
  branchId,
  weekDates,
}: {
  items: ScheduleItem[];
  branchId: string;
  weekDates: Record<string, string>;
}) {
  const [pendingCell, setPendingCell] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isPendingReset, startResetTransition] = useTransition();

  const handleCellChange = (
    ingredientId: string,
    day: string,
    value: string
  ) => {
    const cellKey = `${ingredientId}-${day}`;
    setPendingCell(cellKey);
    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("ingredient_id", ingredientId);
    fd.set("date", weekDates[day]);
    fd.set("quantity", value || "0");
    startTransition(async () => {
      await upsertDistribution(fd);
      setPendingCell(null);
    });
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
      await resetDistributions(fd);
    });
  };

  return (
    <div dir="ltr">
      {/* Actions bar */}
      <div className="flex items-center gap-3 mb-4">
        <button
          onClick={handleReset}
          disabled={isPendingReset}
          className="text-[11px] font-bold text-red-500 hover:text-red-700 transition-colors disabled:opacity-50 flex items-center gap-1 uppercase"
        >
          🗑 Clear Data
        </button>
        <button className="text-[11px] font-bold text-gray-400 hover:text-gray-600 transition-colors flex items-center gap-1 uppercase">
          ↺ Reset Selected
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-gray-100">
        <table className="w-full text-sm border-collapse">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-4 py-3 text-[11px] font-bold text-gray-500 tracking-wider min-w-[120px] uppercase">
                Item
              </th>
              {DAYS.map((day) => (
                <th
                  key={day}
                  className="px-3 py-3 text-[11px] font-bold text-gray-500 tracking-wider min-w-[80px] uppercase"
                >
                  {day}
                </th>
              ))}
              <th className="px-3 py-3 text-[11px] font-bold text-[#2563eb] tracking-wider uppercase">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const rowTotal = DAYS.reduce(
                (sum, day) => sum + (item.distributions[weekDates[day]] || 0),
                0
              );
              return (
                <tr key={item.ingredient_id} className="border-b border-gray-50 hover:bg-gray-50/50">
                  <td className="px-4 py-3 font-medium text-[#052e36] text-left text-sm">
                    {item.ingredient_name}
                  </td>
                  {DAYS.map((day) => {
                    const date = weekDates[day];
                    const cellKey = `${item.ingredient_id}-${day}`;
                    const isPending = pendingCell === cellKey;
                    const val = item.distributions[date] || 0;
                    return (
                      <td key={day} className="px-3 py-2 text-center">
                        <input
                          type="number"
                          min="0"
                          inputMode="numeric"
                          defaultValue={val === 0 ? "" : val}
                          placeholder="0"
                          disabled={isPending}
                          onBlur={(e) => {
                            const newVal = e.target.value;
                            if (Number(newVal) !== val) {
                              handleCellChange(item.ingredient_id, day, newVal);
                            }
                          }}
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
                  <td className="px-3 py-3 text-center font-black text-[#2563eb]">
                    {rowTotal}
                  </td>
                </tr>
              );
            })}
          </tbody>
          {/* Totals row */}
          <tfoot>
            <tr className="border-t border-gray-200">
              <td className="px-4 py-3 text-[11px] font-bold text-gray-500 tracking-wider text-left uppercase">
                Daily Total
              </td>
              {DAYS.map((day) => {
                const date = weekDates[day];
                const colTotal = items.reduce(
                  (sum, item) => sum + (item.distributions[date] || 0),
                  0
                );
                return (
                  <td key={day} className="px-3 py-3 text-center font-bold text-gray-500 text-sm">
                    {colTotal}
                  </td>
                );
              })}
              <td className="px-3 py-3 text-center font-black text-[#2563eb]">
                {items.reduce(
                  (sum, item) =>
                    sum +
                    DAYS.reduce(
                      (s, day) => s + (item.distributions[weekDates[day]] || 0),
                      0
                    ),
                  0
                )}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    </div>
  );
}
