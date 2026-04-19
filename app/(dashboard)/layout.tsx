import { Sidebar } from "@/components/layout/Sidebar";
import { TopHeader } from "@/components/layout/TopHeader";
import { TarekFloatingButton } from "@/components/finance/TarekFloatingButton";
import { getCurrentActor } from "@/lib/auth/actor";
import { redirect } from "next/navigation";

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/login");
  }
  return (
    <div className="flex h-full min-h-screen w-full overflow-x-hidden overflow-y-hidden print:block print:overflow-visible">
      <div className="print:hidden">
        <Sidebar />
      </div>
      <div className="flex-1 flex flex-col h-full overflow-x-hidden overflow-y-hidden relative print:block print:overflow-visible">
        <div className="print:hidden">
          <TopHeader />
        </div>
        <main className="flex-1 overflow-y-auto overflow-x-hidden w-full relative bg-white print:overflow-visible print:bg-white">
          <div className="min-h-full p-4 md:p-8 max-w-7xl mx-auto print:p-0 print:max-w-none">
            {children}
          </div>
        </main>
      </div>

      {/* Global AI Accountant Access */}
      <TarekFloatingButton />
    </div>
  );
}
