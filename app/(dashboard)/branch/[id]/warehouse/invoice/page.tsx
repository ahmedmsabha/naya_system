import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InvoiceActions } from "@/components/warehouse/InvoiceActions";
import { parseWarehouseIsoDate } from "@/lib/warehouse/week-dates";
import { formatDateTimeEn, formatNumberEn } from "@/lib/format/en";

export const dynamic = "force-dynamic";

function generateInvoiceNumber(branchId: string): string {
  const hash = branchId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `NF-${hash}`;
}

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

  const invoiceNumber = generateInvoiceNumber(id);

  let billingDateLabel: string = new Date(`${purchaseDateIso}T12:00:00`).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
  let lineItems: Array<{ name: string; unit: string; qty: number; rate: number; amount: number }> = [];
  let total = 0;
  let isHistorical = false;
  let historicalStatus = "";

  if (historicalInvoiceId) {
    isHistorical = true;
    const { data: invoice } = await supabase
      .from("warehouse_invoices")
      .select("id, invoice_number, total_amount, billing_period_start, billing_period_end, created_at, status")
      .eq("id", historicalInvoiceId)
      .eq("branch_id", id)
      .maybeSingle();

    if (!invoice) notFound();
    historicalStatus = invoice.status;

    const { data: invoiceItems } = await supabase
      .from("warehouse_invoice_items")
      .select("quantity, unit_cost, ingredients ( name, unit )")
      .eq("invoice_id", invoice.id);

    billingDateLabel = new Date(`${invoice.billing_period_end}T12:00:00`).toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });

    lineItems = (invoiceItems ?? []).map((row) => {
      const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
      const qty = Number(row.quantity);
      const rate = Number(row.unit_cost);
      return { name: ing?.name ?? "Unknown", unit: ing?.unit ?? "UNIT", qty, rate, amount: qty * rate };
    });

    total = Number(invoice.total_amount ?? 0) || lineItems.reduce((sum, l) => sum + l.amount, 0);
  } else {
    // Live view: show non-archived delta = current inventoryByDate - latest archived baseline for this date.
    const { data: distRows } = await supabase
      .from("warehouse_distributions")
      .select("ingredient_id, quantity, ingredients ( name, unit, cost_per_unit )")
      .eq("branch_id", id)
      .eq("distributed_at", purchaseDateIso);

    const currentByIngredient: Record<string, number> = {};
    (distRows ?? []).forEach((row) => {
      currentByIngredient[row.ingredient_id] = Number(row.quantity);
    });

    const { data: latestArchive } = await supabase
      .from("warehouse_invoices")
      .select("id")
      .eq("branch_id", id)
      .eq("status", "archived")
      .eq("billing_period_start", purchaseDateIso)
      .eq("billing_period_end", purchaseDateIso)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    let archivedBaselineByIngredient: Record<string, number> = {};
    if (latestArchive?.id) {
      const { data: baselineRows } = await supabase
        .from("warehouse_invoice_items")
        .select("ingredient_id, quantity")
        .eq("invoice_id", latestArchive.id);
      archivedBaselineByIngredient = Object.fromEntries(
        (baselineRows ?? []).map((row) => [row.ingredient_id, Number(row.quantity)])
      );
    }

    lineItems = (distRows ?? [])
      .map((row) => {
        const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
        const rate = Number(ing?.cost_per_unit ?? 0);
        const currentQty = currentByIngredient[row.ingredient_id] ?? 0;
        const baselineQty = archivedBaselineByIngredient[row.ingredient_id] ?? 0;
        const qty = currentQty - baselineQty;
        return { name: ing?.name ?? "Unknown", unit: ing?.unit ?? "UNIT", qty, rate, amount: qty * rate };
      })
      .filter((row) => row.qty > 0);

    total = lineItems.reduce((sum, l) => sum + l.amount, 0);
  }

  return (
    <div className="flex flex-col gap-6 max-w-4xl" dir="ltr">
      <div className="flex flex-col gap-4 print:hidden">
        <Link
          href={`/branch/${id}/warehouse?date=${purchaseDateIso}`}
          className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#a48443]/70 hover:text-[#a48443] transition-colors uppercase self-start ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview · {purchaseDateIso}
        </Link>
        {!isHistorical ? (
          <InvoiceActions
            branchId={id}
            branchName={branch.name}
            purchaseDateIso={purchaseDateIso}
            hasItems={lineItems.length > 0}
          />
        ) : null}
      </div>

      <div className="bg-white rounded-3xl border border-gray-100 p-10 shadow-sm print:shadow-none print:border-none print:p-0 print:w-full">
        {/* Header */}
        <div className="flex items-start justify-between mb-10 border-b border-gray-50 pb-10 print:border-gray-100">
          <div className="flex items-center gap-6">
            <div className="w-16 h-16 bg-[#052e36] rounded-2xl flex items-center justify-center text-white text-3xl font-black shadow-lg shadow-teal-900/20 print:shadow-none">
              N
            </div>
            <div>
              <h1 className="text-3xl font-black text-[#052e36] tracking-tighter">NAYA FOODS, LLC</h1>
              <p className="text-[10px] font-black text-gray-300 tracking-[.4em] uppercase mt-1">
                Supply Chain & Logistics Hub
              </p>
            </div>
          </div>
          <div className="text-right flex flex-col items-end gap-2">
            <div className="bg-[#052e36] text-white px-8 py-4 rounded-2xl font-black text-2xl tracking-widest print:bg-black">
              {isHistorical ? "ARCHIVED" : "INVOICE"}
            </div>
            <p className="text-gray-400 text-sm font-mono tracking-tighter">#{invoiceNumber}</p>
            {isHistorical && (
              <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">
                {historicalStatus}
              </span>
            )}
          </div>
        </div>

        {/* Invoice For + Billing Date */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black text-[#2563eb] tracking-[.3em] uppercase">BILL TO</p>
            <h2 className="text-2xl font-black text-[#052e36] uppercase tracking-tight">{branch.name}</h2>
            <p className="text-gray-400 text-sm font-medium pr-10 leading-relaxed">
              {branch.location || "Branch Location Not Specified"}
            </p>
          </div>
          <div className="flex flex-col items-end text-right gap-2">
            <p className="text-[10px] font-black text-gray-300 tracking-[.3em] uppercase">PURCHASE DATE</p>
            <h2 className="text-3xl font-black text-[#052e36] tracking-tighter">{billingDateLabel}</h2>
            {!isHistorical && (
              <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest">
                Pending archive
              </p>
            )}
          </div>
        </div>

        {/* Line Items */}
        <div className="border-t border-gray-100 pt-8">
          <div className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 mb-4 px-4">
            {["ITEM DESCRIPTION", "QUANTITY", "UNIT PRICE", "TOTAL"].map((h) => (
              <p key={h} className="text-[10px] font-black text-gray-300 tracking-widest uppercase">
                {h}
              </p>
            ))}
          </div>
          <div className="h-px bg-gray-200 mb-6 print:bg-black" />

          <div className="flex flex-col gap-1">
            {lineItems.length === 0 ? (
              <div className="py-20 text-center bg-gray-50/50 rounded-3xl border border-dashed border-gray-200">
                <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">
                  No purchases recorded for {purchaseDateIso}
                </p>
                <p className="text-gray-300 text-xs mt-2">
                  Add or increase quantities in Overview/Schedule for this date, then return here to archive.
                </p>
              </div>
            ) : (
              lineItems.map((item, i) => (
                <div
                  key={i}
                  className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 py-5 px-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors print:border-gray-200"
                >
                  <p className="font-black text-[#052e36] text-sm uppercase tracking-tight">{item.name}</p>
                  <p className="text-gray-600 text-sm font-bold">
                    {item.qty}{" "}
                    <span className="text-[10px] text-gray-400 uppercase tracking-widest ml-1">{item.unit}</span>
                  </p>
                  <p className="text-gray-600 text-sm font-medium">${item.rate.toFixed(2)}</p>
                  <p className="font-black text-[#052e36] text-sm">${item.amount.toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Total */}
        <div className="flex flex-col items-end mt-12 gap-4">
          <div className="w-1/3 h-px bg-gray-200 print:bg-black" />
          <div className="bg-gray-50 rounded-[2.5rem] px-12 py-8 text-right min-w-[320px] print:bg-white print:border print:border-gray-200">
            <p className="text-[10px] font-black text-gray-300 tracking-[.4em] uppercase mb-1">GRAND TOTAL</p>
            <p className="text-5xl font-black text-[#052e36] tracking-tighter">
              ${formatNumberEn(total, { minimumFractionDigits: 2 })}
            </p>
            <div className="flex items-center justify-end gap-2 mt-2">
              <div className="w-2 h-2 bg-[#2563eb] rounded-full" />
              <span className="text-[9px] font-black text-[#2563eb] uppercase tracking-widest">USD Currency</span>
            </div>
          </div>
        </div>

        <div className="hidden print:flex flex-col items-center mt-20 pt-10 border-t border-gray-100 text-center gap-2">
          <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Authenticated Document</p>
          <p className="text-xs font-bold text-[#052e36]">
            NAYA Enterprise Resource Planning System — Generated {formatDateTimeEn(new Date())}
          </p>
        </div>
      </div>
    </div>
  );
}
