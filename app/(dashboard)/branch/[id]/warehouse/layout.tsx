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
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-4rem)] w-full -mx-4 -my-4 md:-mx-8 md:-my-8 overflow-x-hidden print:block print:m-0 print:min-h-0">
      {/* Section navigation: top on mobile, side on desktop */}
      <div className="print:hidden lg:order-last">
        <WarehouseSidebar branchId={id} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto p-4 md:p-8 print:p-0 print:overflow-visible print:w-full">{children}</div>
    </div>
  );
}
