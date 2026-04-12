import { StaffingSidebar } from "@/components/staffing/StaffingSidebar";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";

export const dynamic = "force-dynamic";

export default async function PayrollLayout({
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
    <div className="flex h-full min-h-[calc(100vh-4rem)] w-full -mx-8 -my-8">
      <div className="flex-1 overflow-y-auto p-8">{children}</div>
      <div>
        <StaffingSidebar branchId={id} />
      </div>
    </div>
  );
}
