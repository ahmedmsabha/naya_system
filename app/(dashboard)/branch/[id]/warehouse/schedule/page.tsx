import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { ScheduleTable } from "@/components/warehouse/ScheduleTable";

// Build the current week's dates (Mon → Sun)
function getCurrentWeekDates(): Record<string, string> {
  const today = new Date();
  const dayOfWeek = today.getDay(); // 0=Sun, 1=Mon...
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((dayOfWeek + 6) % 7));

  const days = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
  const result: Record<string, string> = {};
  days.forEach((day, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result[day] = d.toISOString().split("T")[0];
  });
  return result;
}

export default async function WarehouseSchedulePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: branch } = await supabase
    .from("branches")
    .select("name")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  const weekDates = getCurrentWeekDates();
  const weekValues = Object.values(weekDates);

  // Fetch inventory items
  const { data: inventoryRows } = await supabase
    .from("inventory")
    .select(`ingredient_id, ingredients ( name )`)
    .eq("branch_id", id);

  // Fetch distributions for this week
  const { data: distributions } = await supabase
    .from("warehouse_distributions")
    .select("ingredient_id, quantity, distributed_at")
    .eq("branch_id", id)
    .in("distributed_at", weekValues);

  // Build distribution map: ingredient_id → date → quantity
  const distMap: Record<string, Record<string, number>> = {};
  (distributions ?? []).forEach((d) => {
    if (!distMap[d.ingredient_id]) distMap[d.ingredient_id] = {};
    distMap[d.ingredient_id][d.distributed_at] = Number(d.quantity);
  });

  const items = (inventoryRows ?? []).map((row) => {
    const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    return {
      ingredient_id: row.ingredient_id,
      ingredient_name: ing?.name ?? "Unknown",
      distributions: distMap[row.ingredient_id] ?? {},
      weekDates,
    };
  });

  return (
    <div className="flex flex-col gap-6 max-w-5xl" dir="ltr">
      {/* Back link */}
      <Link
        href={`/branch/${id}`}
        className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#a48443]/70 hover:text-[#a48443] transition-colors uppercase self-start"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to {branch.name}
      </Link>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-[#052e36]">
          Distribution Matrix: <span className="text-[#2563eb]">{branch.name}</span>
        </h1>
        <p className="text-gray-400 text-sm mt-1">
          Week: {weekDates.MONDAY} — {weekDates.SUNDAY}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-gray-300 text-4xl mb-4">📋</p>
          <p className="text-gray-500 font-medium">No items available yet</p>
          <p className="text-gray-400 text-sm mt-1">Add items from the Overview page first</p>
        </div>
      ) : (
        <ScheduleTable items={items} branchId={id} weekDates={weekDates} />
      )}
    </div>
  );
}
