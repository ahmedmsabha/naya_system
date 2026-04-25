import { getCachedDashboardNav } from "@/lib/navigation/dashboard-nav";
import { SidebarClient } from "@/components/layout/SidebarClient";

/**
 * Server wrapper: builds role-scoped nav (cache-deduped with TopHeader in the same request).
 */
export async function Sidebar() {
  const items = await getCachedDashboardNav();
  return <SidebarClient items={items} />;
}
