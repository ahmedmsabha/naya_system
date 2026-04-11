import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, FileText } from "lucide-react";
import { AddItemForm } from "@/components/warehouse/AddItemForm";
import { InventoryView } from "@/components/warehouse/InventoryView";
import { getWeekDatesForDate, parseWarehouseIsoDate } from "@/lib/warehouse/week-dates";
import { formatNumberEn } from "@/lib/format/en";

export const dynamic = "force-dynamic";

export default async function WarehouseMainPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ date?: string }>;
}) {
  const { id } = await params;
  const { date: dateParam } = await searchParams;
  const purchaseDateIso = parseWarehouseIsoDate(dateParam);

  const supabase = await createClient();

  const { data: branch } = await supabase
    .from("branches")
    .select("name, location")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  const { data: inventoryRows } = await supabase
    .from("inventory")
    .select(`id, quantity_on_hand, ingredient_id, ingredients ( name, unit, cost_per_unit )`)
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

  const weekDates = getWeekDatesForDate(purchaseDateIso);
  const weekValues = Object.values(weekDates);
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

  // Server-side initial day total (client will update this live)
  const costById: Record<string, number> = {};
  for (const it of items) costById[it.ingredient_id] = it.unit_cost;
  const initialDayTotal = (distributions ?? [])
    .filter((d) => d.distributed_at === purchaseDateIso)
    .reduce((sum, d) => sum + Number(d.quantity) * (costById[d.ingredient_id] ?? 0), 0);

  const { count: invoicesCount } = await supabase
    .from("warehouse_invoices")
    .select("*", { count: "exact", head: true })
    .eq("branch_id", id);

  const headerDate = new Date(`${purchaseDateIso}T12:00:00`);

  return (
    <div className="flex flex-col gap-8 max-w-7xl mx-auto px-4" dir="ltr">
      <Link
        href={`/branch/${id}`}
        className="inline-flex items-center gap-2 text-[11px] font-black tracking-[.25em] text-[#a48443]/60 hover:text-[#a48443] transition-all uppercase self-start group"
      >
        <ArrowLeft className="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
        BACK TO {branch.name.toUpperCase()}
      </Link>

      {/* Stats row */}
      <div className="flex items-center gap-6 flex-wrap">
        {/* Archive count */}
        <div className="bg-[#052e36] rounded-[2rem] px-8 py-6 min-w-[180px] shadow-xl shadow-teal-900/10">
          <p className="text-[10px] font-black text-gray-400 tracking-[.2em] uppercase mb-2">Archive</p>
          <div className="flex items-center gap-3">
            <span className="text-4xl font-black text-white">{invoicesCount || 0}</span>
            <span className="text-gray-400 text-[10px] font-black uppercase tracking-widest mt-2">Invoices</span>
          </div>
        </div>

        {/* Day total — server initial value; updated live by InventoryView via onDayTotalChange */}
        <div className="bg-[#2563eb] rounded-[2rem] px-10 py-8 flex-1 min-w-[240px] shadow-2xl shadow-blue-200/40 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-3xl" />
          <p className="text-[11px] font-black text-blue-100 tracking-[.2em] uppercase mb-2">
            Day purchases total
          </p>
          <p
            className="text-5xl font-black text-white tracking-tighter"
            id="day-total-display"
          >
            ${formatNumberEn(initialDayTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p className="text-[10px] font-bold text-blue-200 mt-2">{purchaseDateIso} — updates as you add items</p>
        </div>

        {/* Date + invoice link */}
        <div className="bg-white rounded-[2rem] px-8 py-6 border border-gray-100 flex flex-col items-center justify-center min-w-[200px] shadow-sm ml-auto gap-3">
          <div className="flex items-center gap-3">
            <Calendar className="w-5 h-5 text-[#2563eb]" />
            <span className="font-black text-[#052e36] text-xl tracking-tight">
              {headerDate.toLocaleDateString("en-US", { month: "2-digit", day: "2-digit", year: "numeric" })}
            </span>
          </div>
          <Link
            href={`/branch/${id}/warehouse/invoice?date=${purchaseDateIso}`}
            className="inline-flex items-center gap-2 text-[11px] font-black text-amber-600 hover:text-amber-700 uppercase tracking-widest whitespace-nowrap"
          >
            <FileText className="w-4 h-4" />
            View / Archive Invoice
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div className="flex flex-col lg:flex-row gap-10 items-start mt-4">
        <div className="flex-1 min-w-0 w-full">
          <InventoryView
            key={`${id}-${purchaseDateIso}-${inventoryFingerprint}`}
            items={items}
            branchId={id}
            purchaseDateIso={purchaseDateIso}
            weekDates={weekDates}
            inventoryByDate={inventoryByDate}
          />
        </div>
        <div className="sticky top-8 w-full lg:w-80 shrink-0">
          <AddItemForm branchId={id} />
        </div>
      </div>
    </div>
  );
}
