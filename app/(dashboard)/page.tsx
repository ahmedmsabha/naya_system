import Link from "next/link";
import { Card } from "@/components/ui/card";
import { MapPin, ChevronRight, AlertCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { redirectNonExecutiveUsersToBranchWarehouse } from "@/lib/navigation/branch-landing";

export default async function GlobalDashboard() {
  await redirectNonExecutiveUsersToBranchWarehouse();
  const supabase = await createClient();
  const { data: branches, error } = await supabase.from("branches").select("*").order("name");

  if (error) {
    return (
      <div className="p-8 text-center bg-red-50 text-red-600 rounded-xl max-w-lg mx-auto mt-20 border border-red-100 flex flex-col items-center">
        <AlertCircle className="w-12 h-12 mb-4" />
        <h2 className="font-bold text-lg mb-2">Database Error</h2>
        <p className="text-sm">Could not fetch branches from Supabase. Have you run the SQL setup script?</p>
      </div>
    );
  }

  // Fallback to demo layout if empty because SQL hasn't been run yet
  const displayBranches = branches?.length > 0 ? branches : [];

  return (
    <div className="pt-2 px-2 max-w-5xl">
      <div className="mb-10 space-y-1">
        <h3 className="text-[11px] font-bold tracking-widest text-[#a48443] uppercase">
          Status: Stable
        </h3>
        <h1 className="text-3xl font-heading font-black text-[#052e36] tracking-tight">
          NAYA ENTERPRISE / DASHBOARD
        </h1>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {displayBranches.map((branch) => (
          <Link key={branch.id} href={`/branch/${branch.id}`} className="group block focus:outline-none focus:ring-2 focus:ring-[#052e36] rounded-[2rem]">
            <Card className="h-full rounded-[2rem] p-8 border-gray-100 shadow-sm hover:shadow-md transition-shadow group-hover:border-gray-200 bg-white group-active:scale-[0.98] duration-200">
              <div className="space-y-6">
                <div className="w-12 h-12 bg-gray-50 rounded-2xl flex items-center justify-center border border-gray-100">
                  <MapPin className="w-6 h-6 text-[#052e36]" />
                </div>

                <div>
                  <h2 className="text-xl font-bold text-[#052e36] mb-2">{branch.name}</h2>
                  <p className="text-xs text-gray-400 max-w-[200px] leading-relaxed">
                    {branch.location}
                  </p>
                </div>

                <div className="pt-8 flex items-center justify-between">
                  <span className="text-[10px] font-bold text-[#a48443] tracking-wider uppercase">
                    {branch.status}
                  </span>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors" />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
