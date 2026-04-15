import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InvoiceActions } from "@/components/warehouse/InvoiceActions";
import { getWeekDatesForDate, parseWarehouseIsoDate, type WeekdayKey } from "@/lib/warehouse/week-dates";
import { formatNumberEn } from "@/lib/format/en";

export const dynamic = "force-dynamic";

const DAY_KEYS: WeekdayKey[] = [
  "MONDAY",
  "TUESDAY",
  "WEDNESDAY",
  "THURSDAY",
  "FRIDAY",
  "SATURDAY",
  "SUNDAY",
];

function generateInvoiceNumber(branchId: string, weekStartIso: string): string {
  const hash = branchId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `NF-${hash}-${weekStartIso.replace(/-/g, "")}`;
}

function dmLabel(iso: string): string {
  const d = new Date(`${iso}T12:00:00`);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}

function formatWeekLongLabel(startIso: string, endIso: string): string {
  const start = new Date(`${startIso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  const end = new Date(`${endIso}T12:00:00`).toLocaleDateString("en-US", {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
  return `${start} - ${end}`;
}

type InvoiceTableRow = {
  ingredientId: string;
  name: string;
  unit: string;
  unitPrice: number;
  dailyQty: [number, number, number, number, number, number, number];
  totalQty: number;
  totalPrice: number;
};

export default async function WarehouseInvoicePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ historical?: string; date?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const supabase = await createClient();
  const historicalInvoiceId = sp.historical;
  const purchaseDateIso = parseWarehouseIsoDate(sp.date);

  const { data: branch } = await supabase
    .from("branches")
    .select("name, location")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  const parsedWeek = getWeekDatesForDate(purchaseDateIso);
  let weekStartIso = parsedWeek.MONDAY;
  let weekEndIso = parsedWeek.SUNDAY;
  let isHistorical = false;
  let historicalStatus = "";
  let storedInvoiceTotal = 0;
  let invoiceNumber = generateInvoiceNumber(id, weekStartIso);

  if (historicalInvoiceId) {
    isHistorical = true;
    const { data: invoice } = await supabase
      .from("warehouse_invoices")
      .select("id, invoice_number, total_amount, billing_period_start, billing_period_end, status")
      .eq("id", historicalInvoiceId)
      .eq("branch_id", id)
      .maybeSingle();

    if (!invoice) notFound();

    weekStartIso = invoice.billing_period_start;
    weekEndIso = invoice.billing_period_end;
    invoiceNumber = invoice.invoice_number || generateInvoiceNumber(id, weekStartIso);
    historicalStatus = invoice.status;
    storedInvoiceTotal = Number(invoice.total_amount ?? 0);
  } else {
    const { data: existingInvoice } = await supabase
      .from("warehouse_invoices")
      .select("invoice_number, total_amount, status")
      .eq("branch_id", id)
      .eq("billing_period_start", weekStartIso)
      .eq("billing_period_end", weekEndIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (existingInvoice?.invoice_number) invoiceNumber = existingInvoice.invoice_number;
    storedInvoiceTotal = Number(existingInvoice?.total_amount ?? 0);
    historicalStatus = String(existingInvoice?.status ?? "");
  }

  const weekDates = getWeekDatesForDate(weekStartIso);
  const weekValues = DAY_KEYS.map((day) => weekDates[day]);
  const dayIndexByIso = Object.fromEntries(weekValues.map((iso, i) => [iso, i]));

  const { data: distRows } = await supabase
    .from("warehouse_distributions")
    .select("ingredient_id, quantity, distributed_at, ingredients ( name, unit, cost_per_unit )")
    .eq("branch_id", id)
    .gte("distributed_at", weekStartIso)
    .lte("distributed_at", weekEndIso)
    .gt("quantity", 0);

  const rowMap = new Map<string, InvoiceTableRow>();
  for (const d of distRows ?? []) {
    const idx = dayIndexByIso[d.distributed_at];
    if (idx === undefined) continue;
    const existing = rowMap.get(d.ingredient_id);
    if (!existing) {
      const ing = Array.isArray(d.ingredients) ? d.ingredients[0] : d.ingredients;
      const next: InvoiceTableRow = {
        ingredientId: d.ingredient_id,
        name: ing?.name ?? "Unknown",
        unit: ing?.unit ?? "UNIT",
        unitPrice: Number(ing?.cost_per_unit ?? 0),
        dailyQty: [0, 0, 0, 0, 0, 0, 0],
        totalQty: 0,
        totalPrice: 0,
      };
      next.dailyQty[idx] = Number(d.quantity ?? 0);
      rowMap.set(d.ingredient_id, next);
      continue;
    }
    existing.dailyQty[idx] += Number(d.quantity ?? 0);
  }

  const lineItems = Array.from(rowMap.values())
    .map((row) => {
      row.totalQty = row.dailyQty.reduce((sum, qty) => sum + qty, 0);
      row.totalPrice = row.totalQty * row.unitPrice;
      return row;
    })
    .filter((row) => row.totalQty > 0)
    .sort((a, b) => a.name.localeCompare(b.name));

  const computedTotal = lineItems.reduce((sum, row) => sum + row.totalPrice, 0);
  const totalsOutOfSync = storedInvoiceTotal > 0 && Math.abs(storedInvoiceTotal - computedTotal) > 0.009;
  const invoiceStatus = historicalStatus || (isHistorical ? "archived" : "pending");
  const actionAnchorIso = isHistorical ? weekStartIso : purchaseDateIso;

  return (
    <div className="flex flex-col gap-6 max-w-7xl w-full" dir="ltr">
      <div className="flex flex-col gap-4 print:hidden">
        <Link
          href={`/branch/${id}/warehouse?date=${purchaseDateIso}`}
          className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#a48443]/70 hover:text-[#a48443] transition-colors uppercase self-start ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview · {purchaseDateIso}
        </Link>
        <InvoiceActions
          branchId={id}
          branchName={branch.name}
          anchorDateIso={actionAnchorIso}
          weekStartIso={weekStartIso}
          weekEndIso={weekEndIso}
          invoiceNumber={invoiceNumber}
          invoiceStatus={invoiceStatus}
          hasItems={lineItems.length > 0}
          pdfRows={lineItems.map((item) => ({
            item: item.name,
            unitPrice: item.unitPrice,
            dailyQty: item.dailyQty,
            totalQty: item.totalQty,
            totalPrice: item.totalPrice,
          }))}
          grandTotal={computedTotal}
        />
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-4 sm:p-6 md:p-8 shadow-sm print:shadow-none print:border-none print:p-0 print:w-full overflow-x-hidden">
        <div className="h-2 bg-blue-900 rounded-full mb-6" />

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 sm:gap-6 pb-6 border-b border-gray-100">
          <div className="space-y-2">
            <p className="text-xs font-semibold text-gray-500">Naya Foods, LLC</p>
            <h1 className="text-3xl md:text-4xl font-black text-[#052e36] tracking-tight">
              Invoice {branch.name.toUpperCase()}
            </h1>
            <p className="text-sm text-gray-600">Orders from {formatWeekLongLabel(weekStartIso, weekEndIso)}</p>
            <p className="text-xs text-gray-400">Invoice #{invoiceNumber}</p>
            {invoiceStatus === "archived" ? (
              <span className="inline-flex items-center rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-[11px] font-black tracking-widest uppercase text-emerald-700">
                ARCHIVED
              </span>
            ) : null}
          </div>
          <div className="text-left sm:text-right space-y-2">
            <div className="text-xs font-black tracking-widest uppercase text-blue-700">Status</div>
            <div className="text-sm font-black uppercase">{invoiceStatus}</div>
            {totalsOutOfSync ? (
              <p className="text-xs font-bold text-amber-600">Displayed values changed since last invoice update.</p>
            ) : (
              <p className="text-xs text-gray-400">Invoice totals are in sync.</p>
            )}
          </div>
        </div>

        <div className="mt-6 overflow-x-auto rounded-2xl border border-gray-200">
          <table className="w-full text-sm border-collapse min-w-[980px] md:min-w-[1120px]">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 text-[11px] font-black tracking-widest uppercase text-gray-600">
                  Item
                </th>
                <th className="text-right px-3 py-3 text-[11px] font-black tracking-widest uppercase text-gray-600">
                  Unit Price
                </th>
                {DAY_KEYS.map((day) => {
                  const iso = weekDates[day];
                  return (
                    <th
                      key={day}
                      className="text-center px-2 py-3 text-[11px] font-black tracking-widest uppercase text-gray-600 min-w-[76px]"
                    >
                      <div>{day.slice(0, 3)}</div>
                      <div className="text-[10px] text-blue-700 normal-case font-bold mt-0.5">{dmLabel(iso)}</div>
                    </th>
                  );
                })}
                <th className="text-right px-3 py-3 text-[11px] font-black tracking-widest uppercase text-blue-700">
                  Total Qty
                </th>
                <th className="text-right px-3 py-3 text-[11px] font-black tracking-widest uppercase text-blue-700">
                  Total Price
                </th>
              </tr>
            </thead>
            <tbody>
              {lineItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="py-16 text-center text-sm text-gray-500">
                    No purchases recorded for this week. Add quantities in Overview/Schedule and click Update Invoice.
                  </td>
                </tr>
              ) : (
                lineItems.map((item) => (
                  <tr key={item.ingredientId} className="border-b border-gray-100 hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-semibold text-[#052e36]">
                      {item.name}
                      <span className="ml-2 text-[10px] uppercase text-gray-400 tracking-widest">{item.unit}</span>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      ${formatNumberEn(item.unitPrice, { minimumFractionDigits: 2, maximumFractionDigits: 4 })}
                    </td>
                    {item.dailyQty.map((qty, idx) => (
                      <td key={idx} className="px-2 py-3 text-center tabular-nums">
                        {qty > 0 ? qty : 0}
                      </td>
                    ))}
                    <td className="px-3 py-3 text-right font-bold text-blue-700 tabular-nums">{item.totalQty}</td>
                    <td className="px-3 py-3 text-right font-black text-[#052e36] tabular-nums">
                      ${formatNumberEn(item.totalPrice, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50">
                <td className="px-4 py-4 text-[11px] font-black uppercase tracking-widest text-gray-600">Grand Total</td>
                <td colSpan={9} />
                <td className="px-3 py-4 text-right text-2xl font-black text-[#be185d] tabular-nums">
                  ${formatNumberEn(computedTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
          <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50/40">
            <p className="text-[10px] font-black tracking-widest uppercase text-gray-500">Week Range</p>
            <p className="font-semibold text-[#052e36] mt-1">{formatWeekLongLabel(weekStartIso, weekEndIso)}</p>
          </div>
          <div className="rounded-2xl border border-gray-100 p-4 bg-gray-50/40 text-left md:text-right">
            <p className="text-[10px] font-black tracking-widest uppercase text-gray-500">Saved Invoice Total</p>
            <p className="font-semibold text-[#052e36] mt-1">
              ${formatNumberEn(storedInvoiceTotal || computedTotal, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
