import Link from "next/link";
import { Card } from "@/components/ui/card";
import { createClient } from "@/lib/supabase/server";
import { ArrowRight, Building2 } from "lucide-react";
import { monthKeyNow } from "@/lib/domain/date";

type ModuleBranchPickerProps = {
  title: string;
  subtitle: string;
  buildHref: (branchId: string) => string;
  emptyHint: string;
};

export async function ModuleBranchPicker({
  title,
  subtitle,
  buildHref,
  emptyHint,
}: ModuleBranchPickerProps) {
  const supabase = await createClient();
  const { data: branches } = await supabase
    .from("branches")
    .select("id, name, location, status")
    .order("name", { ascending: true });

  const rows = branches ?? [];
  const currentPeriod = monthKeyNow();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-black tracking-tight text-[#052e36]">{title}</h1>
        <p className="mt-2 text-sm text-slate-500">{subtitle}</p>
        <p className="mt-1 text-xs font-semibold text-slate-400">Default period: {currentPeriod}</p>
      </div>

      {rows.length === 0 ? (
        <Card className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          {emptyHint}
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {rows.map((branch) => (
            <Link
              key={branch.id}
              href={buildHref(String(branch.id))}
              className="group block rounded-2xl border border-slate-200 bg-white p-5 shadow-sm hover:shadow-md hover:border-slate-300 transition-all"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">
                    Branch
                  </p>
                  <h2 className="mt-1 text-xl font-black text-slate-900">{String(branch.name ?? "")}</h2>
                  <p className="mt-1 text-sm text-slate-500">{String(branch.location ?? "No location")}</p>
                </div>
                <div className="rounded-xl bg-slate-100 p-2 text-slate-600">
                  <Building2 className="h-5 w-5" />
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between">
                <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  {String(branch.status ?? "active")}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-black uppercase tracking-[0.16em] text-[#2563eb]">
                  Open
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

