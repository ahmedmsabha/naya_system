import { WarehouseSidebar } from "@/components/warehouse/WarehouseSidebar";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export default async function WarehouseLayout({
  children,
  params,
}: {
  children: React.ReactNode;
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

  return (
    <div className="flex h-full min-h-[calc(100vh-4rem)] w-full -mx-8 -my-8 print:block print:m-0 print:min-h-0">
      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-8 print:p-0 print:overflow-visible print:w-full">{children}</div>

      {/* Right sidebar */}
      <div className="print:hidden">
        <WarehouseSidebar branchId={id} />
      </div>
    </div>
  );
}
