import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Calendar, FileText, ExternalLink } from "lucide-react";
import { DeleteArchiveButton } from "@/components/warehouse/DeleteArchiveButton";

export const dynamic = "force-dynamic";

export default async function WarehouseArchivePage({
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

  // Fetch archived invoices
  const { data: invoices } = await supabase
    .from("warehouse_invoices")
    .select("id, invoice_number, total_amount, billing_period_end, created_at")
    .eq("branch_id", id)
    .eq("status", "archived")
    .order("billing_period_end", { ascending: false });

  // Group by month
  const grouped: Record<string, typeof invoices> = {};
  (invoices ?? []).forEach((inv) => {
    // Use the invoice’s own period end date for archive grouping/sorting,
    // so the archive reflects the day the invoice was generated for.
    const date = new Date(inv.billing_period_end);
    const key = date.toLocaleDateString("en-US", { year: "numeric", month: "long" });
    if (!grouped[key]) grouped[key] = [];
    grouped[key]!.push(inv);
  });

  return (
    <div className="flex flex-col gap-6 max-w-3xl" dir="ltr">
      {/* Header */}
      <div className="flex flex-col items-start gap-1">
        <h1 className="text-4xl font-black text-[#052e36] tracking-tight">Invoice Archive</h1>
        <p className="text-gray-400 text-sm font-bold flex items-center gap-2">
          {branch.name} <span className="opacity-50 font-normal underline">Historical Operations Ledger</span>
        </p>
      </div>

      {Object.keys(grouped).length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center bg-gray-50/50 rounded-[3rem] border border-gray-100 border-dashed">
          <p className="text-gray-300 text-5xl mb-6">🗂</p>
          <p className="text-gray-500 font-bold text-xl">No Archived Records</p>
          <p className="text-gray-400 text-sm mt-2 max-w-xs">
            Completed invoices will appear here after they are officially archived from the billing view.
          </p>
          <Link
            href={`/branch/${id}/warehouse/invoice`}
            className="mt-8 inline-flex items-center gap-2 px-8 py-4 bg-[#052e36] text-white rounded-2xl text-sm font-black hover:bg-[#08434f] transition-all shadow-lg shadow-teal-900/10 uppercase tracking-widest"
          >
            Review Current Billing
          </Link>
        </div>
      ) : (
        <div className="flex flex-col gap-12 mt-8">
          {Object.entries(grouped).map(([month, invs]) => (
            <div key={month} className="flex flex-col gap-6">
              <h2 className="text-[#2563eb] font-black text-xs tracking-[.4em] uppercase opacity-60 ml-2">{month}</h2>
              <div className="flex flex-col md:flex-row flex-wrap gap-8">
                {(invs ?? []).map((inv) => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-[3rem] border border-gray-100 p-8 flex flex-col gap-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all w-full max-w-[420px] relative overflow-hidden group"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex flex-col gap-1">
                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest">Total Valuation</span>
                        <span className="text-5xl font-black text-[#052e36] tracking-tighter">
                          ${Number(inv.total_amount).toLocaleString(undefined, { minimumFractionDigits: 1 })}
                        </span>
                      </div>
                      
                      <div className="w-20 h-20 bg-gray-50 rounded-3xl flex items-center justify-center border border-gray-100 group-hover:bg-[#2563eb] transition-colors">
                        <FileText className="w-10 h-10 text-gray-200 group-hover:text-white transition-colors" />
                      </div>
                    </div>

                    <div className="flex flex-col items-center justify-center py-4 text-center border-t border-gray-50">
                       <span className="text-[10px] font-black text-gray-300 uppercase tracking-[.3em] mb-1">Invoice Label</span>
                       <h3 className="text-lg font-black text-[#052e36] uppercase tracking-tight">
                         {branch.name} #{inv.invoice_number}
                       </h3>
                       <div className="mt-3 inline-flex items-center gap-2 text-[10px] font-black text-gray-400 tracking-[.25em] uppercase">
                         <Calendar className="w-3.5 h-3.5 text-gray-300" />
                         <span>
                           {new Date(inv.billing_period_end).toLocaleDateString("en-US", {
                             month: "short",
                             day: "2-digit",
                             year: "numeric",
                           })}
                         </span>
                       </div>
                    </div>

                    <div className="flex gap-3">
                      <Link
                        href={`/branch/${id}/warehouse/invoice?historical=${inv.id}`}
                        className="flex-1 bg-[#f4f7fe] hover:bg-[#2563eb] py-5 rounded-2xl flex items-center justify-center gap-3 transition-all group/btn shadow-sm"
                      >
                        <ExternalLink className="w-5 h-5 text-[#2563eb] group-hover/btn:text-white transition-all" />
                        <span className="font-black text-[#2563eb] text-sm group-hover/btn:text-white uppercase tracking-widest">Review</span>
                      </Link>
                      <div className="w-32">
                        <DeleteArchiveButton invoiceId={inv.id} branchId={id} />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
