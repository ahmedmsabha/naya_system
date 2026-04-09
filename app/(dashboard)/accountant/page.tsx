import { createClient } from "@/lib/supabase/server";
import { TarekAccountant } from "@/components/finance/TarekAccountant";

export default async function AccountantPage() {
  const supabase = await createClient();
  
  // Fetch invoices for the accountant
  const { data: invoices } = await supabase
    .from("tarek_invoices")
    .select("*")
    .order("created_at", { ascending: false });

  // Calculate stats
  const totalBudget = (invoices ?? []).reduce((sum, inv) => sum + Number(inv.amount), 0);
  const manassasProject = (invoices ?? [])
    .filter(inv => inv.project_name?.toLowerCase().includes("manassas"))
    .reduce((sum, inv) => sum + Number(inv.amount), 0);
  const otherExpenses = totalBudget - manassasProject;

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col items-start gap-1">
        <h3 className="text-[10px] font-black tracking-[.4em] text-[#a48443] uppercase ml-1">
          Smart Financial Hub
        </h3>
        <h1 className="text-4xl font-black text-[#052e36] tracking-tighter uppercase">
          Tarek Accountant <span className="text-[#2563eb] font-light">/ AI Dashboard</span>
        </h1>
      </div>

      <TarekAccountant 
        initialInvoices={invoices ?? []} 
        stats={{
          total: totalBudget,
          project: manassasProject,
          other: otherExpenses
        }}
      />
    </div>
  );
}
