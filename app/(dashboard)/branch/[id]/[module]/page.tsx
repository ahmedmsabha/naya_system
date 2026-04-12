import Link from "next/link";
import { ArrowLeft, Warehouse, Users, BarChart3, Settings, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function ModuleDashboard({
  params,
}: {
  params: Promise<{ id: string; module: string }>;
}) {
  const { id, module } = await params;

  const supabase = await createClient();
  const { data: branch } = await supabase
    .from("branches")
    .select("name")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  const branchName = branch.name;
  const moduleName = module.charAt(0).toUpperCase() + module.slice(1);

  // Pick correct icon
  let Icon = Settings;
  if (module === "warehouse") Icon = Warehouse;
  else if (module === "staffing") Icon = Users;
  else if (module === "payroll") Icon = Wallet;
  else if (module === "financials") Icon = BarChart3;

  return (
    <div className="max-w-6xl">
      <Link
        href={`/branch/${id}`}
        className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#a48443]/70 hover:text-[#a48443] transition-colors uppercase mb-16 focus:outline-none"
      >
        <ArrowLeft className="w-4 h-4" />
        Back To {branchName} Home
      </Link>

      <div className="max-w-3xl mx-auto flex flex-col items-center justify-center text-center">
        <div className="w-20 h-20 bg-gray-50 rounded-[1.5rem] flex items-center justify-center border border-gray-100 mb-8">
          <Icon className="w-8 h-8 text-[#a48443]" strokeWidth={2} />
        </div>

        <h1 className="text-3xl sm:text-4xl font-black text-[#052e36] tracking-tight mb-4">
          {moduleName} Section
        </h1>

        <p className="text-gray-400 text-lg max-w-md mx-auto mb-16 leading-relaxed">
          This is where you manage {module} specifically for the{" "}
          {branchName} branch.
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-4 w-full max-w-2xl mx-auto">
          <Card className="flex-1 p-8 rounded-[2rem] border-gray-50 bg-gray-50/50 shadow-sm w-full flex flex-col items-start gap-3">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              Primary Action
            </span>
            <Button className="w-full bg-[#052e36] text-white hover:bg-[#08434f] rounded-xl h-12 font-semibold">
              View Full Reports
            </Button>
          </Card>

          <Card className="flex-1 p-8 rounded-[2rem] border-gray-50 bg-gray-50/50 shadow-sm w-full flex flex-col items-start gap-3">
            <span className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
              Secondary Action
            </span>
            <Button variant="outline" className="w-full border-gray-200 text-[#052e36] hover:bg-white hover:border-[#052e36] rounded-xl h-12 font-semibold">
              Edit Database
            </Button>
          </Card>
        </div>
      </div>
    </div>
  );
}
