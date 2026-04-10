import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar } from "lucide-react";
import { AddItemForm } from "@/components/warehouse/AddItemForm";
import { InventoryView } from "@/components/warehouse/InventoryView";

export const dynamic = "force-dynamic";

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

export default async function WarehouseMainPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  // Fetch branch
  const { data: branch } = await supabase
    .from("branches")
    .select("name, location")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  // Fetch inventory for this branch with ingredient details
  const { data: inventoryRows } = await supabase
    .from("inventory")
    .select(
      `id, quantity_on_hand, ingredient_id,
       ingredients ( name, unit, cost_per_unit )`
    )
    .eq("branch_id", id)
    .order("ingredients(name)");

  const items = (inventoryRows ?? []).map((row) => {
    const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    const qty = Number(row.quantity_on_hand);
    const cost = Number(ing?.cost_per_unit ?? 0);
    return {
      id: row.id,
      ingredient_id: row.ingredient_id,
      ingredient_name: ing?.name ?? "Unknown",
      unit: ing?.unit ?? "UNIT",
      quantity_on_hand: qty,
      unit_cost: cost,
      total_value: qty * cost,
    };
  });

  // Pull current-week distributions so Overview can show per-day details
  const weekDates = getCurrentWeekDates();
  const weekValues = Object.values(weekDates);
  const { data: distributions } = await supabase
    .from("warehouse_distributions")
    .select("ingredient_id, quantity, distributed_at")
    .eq("branch_id", id)
    .in("distributed_at", weekValues);

  const distributionsByIngredient: Record<string, Record<string, number>> = {};
  (distributions ?? []).forEach((d) => {
    if (!distributionsByIngredient[d.ingredient_id]) distributionsByIngredient[d.ingredient_id] = {};
    distributionsByIngredient[d.ingredient_id][d.distributed_at] = Number(d.quantity);
  });

  // Fetch total invoices for the badge
  const { count: invoicesCount } = await supabase
    .from("warehouse_invoices")
    .select('*', { count: 'exact', head: true })
    .eq("branch_id", id);

  // Weekly stats
  const today = new Date();

  // Compute total value
  const totalValue = items.reduce((acc, i) => acc + i.total_value, 0);

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto px-4" dir="ltr">
      {/* Back link */}
      <Link
        href={`/branch/${id}`}
        className="inline-flex items-center gap-2 text-[11px] font-black tracking-[.25em] text-[#a48443]/60 hover:text-[#a48443] transition-all uppercase self-start group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        BACK TO {branch.name.toUpperCase()}
      </Link>

      {/* Top Stats Row */}
      <div className="flex items-center gap-6 flex-wrap">
        {/* Archive / Invoice count */}
        <div className="bg-[#052e36] rounded-[2rem] px-8 py-6 min-w-[180px] shadow-xl shadow-teal-900/10">
          <p className="text-[10px] font-black text-gray-400 tracking-[.2em] uppercase mb-2">
            Archive
          </p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-black text-white">{invoicesCount || 0}</span>
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Invoices</span>
          </div>
        </div>

        {/* Current Inventory Value */}
        <div className="bg-[#2563eb] rounded-[2rem] px-10 py-8 flex-1 min-w-[240px] shadow-2xl shadow-blue-200/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <p className="text-[11px] font-black text-blue-100 tracking-[.2em] uppercase mb-2">
            Stock Valuation
          </p>
          <p className="text-5xl font-black text-white tracking-tighter">
            ${totalValue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
        </div>

        {/* Date tracker */}
        <div className="bg-white rounded-[2rem] px-8 py-6 border border-gray-100 flex flex-col items-center justify-center min-w-[200px] shadow-sm ml-auto">
          <p className="text-[10px] font-black text-gray-300 tracking-[.2em] uppercase mb-3">
            Accounting Date
          </p>
          <div className="flex items-center gap-3">
             <Calendar className="w-5 h-5 text-[#2563eb]" />
             <span className="font-black text-[#052e36] text-xl tracking-tight">
               {today.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
             </span>
          </div>
        </div>
      </div>

      {/* Main content area: inventory grid + add form */}
      <div className="flex flex-col lg:flex-row gap-10 items-start mt-4">
        {/* Inventory view (headers & grid) */}
        <div className="flex-1 min-w-0 w-full">
          <InventoryView
            items={items}
            branchId={id}
            weekDates={weekDates}
            distributionsByIngredient={distributionsByIngredient}
          />
        </div>

        {/* Add item form sidebar */}
        <div className="sticky top-8 w-full lg:w-80 shrink-0">
          <AddItemForm branchId={id} />
        </div>
      </div>
    </div>
  );
}
