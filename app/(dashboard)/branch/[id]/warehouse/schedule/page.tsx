import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScheduleTable } from "@/components/warehouse/ScheduleTable";
import { ScheduleDateNav } from "@/components/warehouse/ScheduleDateNav";
import { getWeekDatesForDate, parseWarehouseIsoDate } from "@/lib/warehouse/week-dates";

export const dynamic = "force-dynamic";

export default async function WarehouseSchedulePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const anchorIso = parseWarehouseIsoDate(dateParam);

  const supabase = await createClient();

  const { data: branch } = await supabase.from("branches").select("name").eq("id", id).single();

  if (!branch) notFound();

  const weekDates = getWeekDatesForDate(anchorIso);
  const weekValues = Object.values(weekDates);
  const weekStartIso = weekDates.MONDAY;
  const weekEndIso = weekDates.SUNDAY;

  const { data: inventoryRows } = await supabase
    .from("inventory")
    .select(`ingredient_id, ingredients ( name, cost_per_unit )`)
    .eq("branch_id", id);

  const { data: distributions } = await supabase
    .from("warehouse_distributions")
    .select("ingredient_id, quantity, distributed_at")
    .eq("branch_id", id)
    .in("distributed_at", weekValues);

  const inventoryByDate: Record<string, Record<string, number>> = {};
  (distributions ?? []).forEach((d) => {
    if (!inventoryByDate[d.distributed_at]) inventoryByDate[d.distributed_at] = {};
    inventoryByDate[d.distributed_at][d.ingredient_id] = Number(d.quantity);
  });
  const inventoryFingerprint = Object.keys(inventoryByDate)
    .sort()
    .flatMap((date) =>
      Object.keys(inventoryByDate[date] ?? {})
        .sort()
        .map((ingredientId) => `${date}:${ingredientId}:${inventoryByDate[date]?.[ingredientId] ?? 0}`)
    )
    .join("|");

  const items = (inventoryRows ?? []).map((row) => {
    const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    return {
      ingredient_id: row.ingredient_id,
      ingredient_name: ing?.name ?? "Unknown",
      unit_cost: Number(ing?.cost_per_unit ?? 0),
    };
  });

  return (
    <div className="flex flex-col gap-6 max-w-6xl w-full" dir="ltr">
      <Link
        href={`/branch/${id}`}
        className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#a48443]/70 hover:text-[#a48443] transition-colors uppercase self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {branch.name}
      </Link>

      <div>
        <h1 className="text-xl sm:text-2xl font-black text-[#052e36]">
          Distribution schedule: <span className="text-[#2563eb]">{branch.name}</span>
        </h1>
        <p className="text-gray-400 text-sm mt-2 max-w-2xl">
          Uses the same calendar week and <code className="text-gray-600">warehouse_distributions</code> rows as{" "}
          <strong>Overview</strong>. Pick a date to move the week; cell for <strong>17/4</strong> matches Overview when
          both use that ISO day.
        </p>
        <div className="mt-4">
          <ScheduleDateNav
            branchId={id}
            anchorIso={anchorIso}
            weekStartIso={weekStartIso}
            weekEndIso={weekEndIso}
          />
        </div>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-300 text-4xl mb-4">📋</p>
          <p className="text-gray-500 font-medium">No items available yet</p>
          <p className="text-gray-400 text-sm mt-1">Add items from the Overview page first</p>
        </div>
      ) : (
        <ScheduleTable
          key={`${id}-${weekDates.MONDAY}-${items.map((x) => x.ingredient_id).join(",")}-${inventoryFingerprint}`}
          items={items}
          branchId={id}
          selectedDateIso={anchorIso}
          weekDates={weekDates as Record<string, string>}
          inventoryByDate={inventoryByDate}
        />
      )}
    </div>
  );
}
