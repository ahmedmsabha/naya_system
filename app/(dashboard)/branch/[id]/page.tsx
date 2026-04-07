import Link from "next/link";
import { Card } from "@/components/ui/card";
import { ArrowLeft, Warehouse, Users, BarChart3, Settings, ChevronRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function BranchDashboard({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: branch } = await supabase
    .from("branches")
    .select("*")
    .eq("id", id)
    .single();

  if (!branch) notFound();

  const branchName = branch.name;

  const modules = [
    {
      id: "warehouse",
      title: "Warehouse",
      subtitle: "Inventory & Stock",
      icon: Warehouse,
    },
    {
      id: "staffing",
      title: "Staffing",
      subtitle: "Employee Records",
      icon: Users,
    },
    {
      id: "financials",
      title: "Financials",
      subtitle: "P&L Reports",
      icon: BarChart3,
    },
    {
      id: "settings",
      title: "Settings",
      subtitle: "Branch Config",
      icon: Settings,
    },
  ];

  return (
    <div className="max-w-6xl">
      <Link
        href="/"
        className="inline-flex items-center gap-2 text-[11px] font-bold tracking-widest text-[#a48443]/70 hover:text-[#a48443] transition-colors uppercase mb-8 focus:outline-none"
      >
        <ArrowLeft className="w-4 h-4" />
        Back To All Branches
      </Link>

      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6 mb-16">
        <div>
          <h1 className="text-4xl font-black text-[#052e36] tracking-tight mb-2">
            {branchName}
          </h1>
          <p className="text-gray-400 text-lg">Branch Operation Center</p>
        </div>

        <div className="flex items-center gap-4">
          <div className="bg-[#eaf8f3] px-6 py-4 rounded-xl min-w-[140px] border border-[#d2f2e5]">
            <p className="text-[10px] font-bold text-[#10b981] tracking-widest uppercase mb-1">
              Daily Profit
            </p>
            <p className="text-3xl font-black text-[#10b981]">$12.5k</p>
          </div>
          <div className="bg-[#eef5fe] px-6 py-4 rounded-xl min-w-[140px] border border-[#ddebfe]">
            <p className="text-[10px] font-bold text-[#2563eb] tracking-widest uppercase mb-1">
              Active Staff
            </p>
            <p className="text-3xl font-black text-[#2563eb]">12</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {modules.map((module) => (
          <Link
            key={module.id}
            href={`/branch/${id}/${module.id}`}
            className="group block focus:outline-none focus:ring-2 focus:ring-[#052e36] rounded-[2.5rem]"
          >
            <Card className="h-full rounded-[2.5rem] p-10 border-gray-100 shadow-sm hover:shadow-md transition-shadow group-hover:border-gray-200 bg-white group-active:scale-[0.98] duration-200">
              <div className="space-y-12 mb-8">
                <div className="w-14 h-14 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
                  <module.icon className="w-6 h-6 text-[#052e36]" strokeWidth={2} />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-[#052e36] mb-2">{module.title}</h2>
                  <p className="text-xs text-gray-400">{module.subtitle}</p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-[#a48443] tracking-widest uppercase group-hover:text-[#8b6f39] transition-colors">
                  Enter Section
                </span>
                <ChevronRight className="w-3 h-3 text-[#a48443] group-hover:text-[#8b6f39] transition-colors" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
