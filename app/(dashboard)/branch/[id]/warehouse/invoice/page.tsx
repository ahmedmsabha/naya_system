import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InvoiceActions } from "@/components/warehouse/InvoiceActions";

function generateInvoiceNumber(branchId: string): string {
  const hash = branchId.replace(/-/g, "").slice(0, 6).toUpperCase();
  return `NF-${hash}`;
}

export default async function WarehouseInvoicePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: branch } = await supabase
    .from("branches")
    .select("name, location")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  // Fetch inventory items with costs
  const { data: inventoryRows } = await supabase
    .from("inventory")
    .select(`quantity_on_hand, ingredients ( name, unit, cost_per_unit )`)
    .eq("branch_id", id)
    .gt("quantity_on_hand", 0);

  const lineItems = (inventoryRows ?? []).map((row) => {
    const ing = Array.isArray(row.ingredients) ? row.ingredients[0] : row.ingredients;
    const qty = Number(row.quantity_on_hand);
    const rate = Number(ing?.cost_per_unit ?? 0);
    return {
      name: ing?.name ?? "Unknown",
      unit: ing?.unit ?? "UNIT",
      qty,
      rate,
      amount: qty * rate,
    };
  });

  const total = lineItems.reduce((sum, l) => sum + l.amount, 0);

  const today = new Date();
  const billingEnd = new Date(today);
  billingEnd.setDate(today.getDate() + 6);
  const invoiceNumber = generateInvoiceNumber(id);

  // Fetch active invoice DB record if it exists
  const { data: activeInvoice } = await supabase
    .from("warehouse_invoices")
    .select("id")
    .eq("branch_id", id)
    .eq("status", "active")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  return (
    <div className="flex flex-col gap-6 max-w-4xl" dir="ltr">
      {/* Actions bar - Hidden on print */}
      <div className="flex flex-col gap-4 print:hidden">
        <Link
          href={`/branch/${id}/warehouse`}
          className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#a48443]/70 hover:text-[#a48443] transition-colors uppercase self-start ml-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Overview
        </Link>
        <InvoiceActions branchId={id} branchName={branch.name} invoiceId={activeInvoice?.id} />
      </div>

      {/* Invoice Card - Optimized for Printing */}
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
              INVOICE
            </div>
            <p className="text-gray-400 text-sm font-mono tracking-tighter">#{invoiceNumber}</p>
          </div>
        </div>

        {/* Invoice For + Billing Period */}
        <div className="grid grid-cols-2 gap-12 mb-12">
          <div className="flex flex-col gap-2">
            <p className="text-[10px] font-black text-[#2563eb] tracking-[.3em] uppercase">
              BILL TO
            </p>
            <h2 className="text-2xl font-black text-[#052e36] uppercase tracking-tight">{branch.name}</h2>
            <p className="text-gray-400 text-sm font-medium pr-10 leading-relaxed">{branch.location || "Branch Location Not Specified"}</p>
          </div>
          <div className="flex flex-col items-end text-right gap-2">
            <p className="text-[10px] font-black text-gray-300 tracking-[.3em] uppercase">
              BILLING PERIOD END
            </p>
            <h2 className="text-3xl font-black text-[#052e36] tracking-tighter">
              {billingEnd.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
            </h2>
            <p className="text-gray-400 text-xs font-medium">
              Computation period starts {today.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
            </p>
          </div>
        </div>

        {/* Line Items Table */}
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
                <p className="text-gray-400 text-sm font-medium uppercase tracking-widest">No items pending in current billing cycle</p>
              </div>
            ) : (
              lineItems.map((item, i) => (
                <div key={i} className="grid grid-cols-[2fr_1fr_1fr_1fr] gap-4 py-5 px-4 border-b border-gray-50 hover:bg-gray-50/50 transition-colors print:border-gray-200">
                  <p className="font-black text-[#052e36] text-sm uppercase tracking-tight">{item.name}</p>
                  <p className="text-gray-600 text-sm font-bold">
                    {item.qty} <span className="text-[10px] text-gray-400 uppercase tracking-widest ml-1">{item.unit}</span>
                  </p>
                  <p className="text-gray-600 text-sm font-medium">${item.rate.toFixed(2)}</p>
                  <p className="font-black text-[#052e36] text-sm">${item.amount.toFixed(2)}</p>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Total Summary */}
        <div className="flex flex-col items-end mt-12 gap-4">
          <div className="w-1/3 h-px bg-gray-200 print:bg-black" />
          <div className="bg-gray-50 rounded-[2.5rem] px-12 py-8 text-right min-w-[320px] print:bg-white print:border print:border-gray-200">
            <p className="text-[10px] font-black text-gray-300 tracking-[.4em] uppercase mb-1">
              GRAND TOTAL
            </p>
            <p className="text-5xl font-black text-[#052e36] tracking-tighter">${total.toLocaleString(undefined, { minimumFractionDigits: 2 })}</p>
            <div className="flex items-center justify-end gap-2 mt-2">
              <div className="w-2 h-2 bg-[#2563eb] rounded-full" />
              <span className="text-[9px] font-black text-[#2563eb] uppercase tracking-widest">USD Currency</span>
            </div>
          </div>
        </div>

        {/* Print Only Footer */}
        <div className="hidden print:flex flex-col items-center mt-20 pt-10 border-t border-gray-100 text-center gap-2">
           <p className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Authenticated Document</p>
           <p className="text-xs font-bold text-[#052e36]">NAYA Enterprise Resource Planning System - Generated {new Date().toLocaleString()}</p>
        </div>
      </div>
    </div>
  );
}
