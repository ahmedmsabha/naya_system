import { StaffingSidebar } from "@/components/staffing/StaffingSidebar";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function StaffingLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const { data: branch } = await supabase.from("branches").select("name").eq("id", id).single();
  if (!branch) notFound();

  return (
    <div className="flex flex-col lg:flex-row h-full min-h-[calc(100vh-4rem)] w-full -mx-4 -my-4 md:-mx-8 md:-my-8 overflow-x-hidden">
      <div className="print:hidden lg:order-last">
        <StaffingSidebar branchId={id} />
      </div>

      <div className="flex-1 overflow-y-auto p-4 md:p-8">{children}</div>
    </div>
  );
}

