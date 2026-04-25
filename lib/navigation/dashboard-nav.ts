import "server-only";

import { cache } from "react";
import { getCurrentActor, type CurrentActor } from "@/lib/auth/actor";

/** Serializable for server → client; mapped to Lucide icons in the sidebar client. */
export const NAV_ICON_NAMES = [
  "LayoutDashboard",
  "Target",
  "BarChart3",
  "Warehouse",
  "Users",
  "HandCoins",
  "Truck",
  "Settings",
  "Wallet",
] as const;

export type NavIconName = (typeof NAV_ICON_NAMES)[number];

export type DashboardNavItem = {
  name: string;
  href: string;
  icon: NavIconName;
};

/**
 * Deduplicate actor fetch + nav build in one request (Sidebar + TopHeader + layout if needed).
 */
export const getCachedDashboardNav = cache(
  async (): Promise<DashboardNavItem[]> => {
    const actor = await getCurrentActor();
    return getDashboardNavItems(actor);
  }
);

/**
 * Resolves a canonical role for module visibility (aligns with JWT/DB Rbac matrix).
 */
function effectiveRbacKey(actor: CurrentActor): string {
  if (actor.isSuperAdmin) return "super_admin";
  if (actor.legacyRole) return String(actor.legacyRole);
  const rank = ["branch_manager", "branch_staff", "warehouse_manager"] as const;
  for (const r of rank) {
    if (actor.roleKeys.includes(r)) return r;
  }
  if (actor.roleKeys.length) return actor.roleKeys[0] ?? "unknown";
  return "unknown";
}

/**
 * For branch users, module paths are under `/branch/:id/...` when `branchId` is set;
 * `super_admin` uses global entry screens where they exist in this app.
 */
export function getDashboardNavItems(
  actor: CurrentActor | null
): DashboardNavItem[] {
  if (!actor) {
    return [];
  }

  const key = effectiveRbacKey(actor);
  const superAdmin = key === "super_admin";
  const branchId = actor.legacyBranchId;

  const items: DashboardNavItem[] = [];

  if (superAdmin) {
    items.push(
      { name: "Global Dashboard", href: "/", icon: "LayoutDashboard" },
      { name: "Investor", href: "/investor", icon: "Target" },
      { name: "Smart Accountant", href: "/accountant", icon: "Wallet" },
      { name: "Team Settings", href: "/settings/team", icon: "Settings" }
    );
    // Global “picker” routes in this app (no `[branchId]` in the path).
    items.push(
      { name: "Financials", href: "/financials", icon: "BarChart3" },
      { name: "Warehouse", href: "/warehouse", icon: "Warehouse" },
      { name: "Staffing", href: "/staffing", icon: "Users" }
    );
    return items;
  }

  if (!branchId) {
    // Fall back to empty branch links; parent layout or middleware will redirect to login
    return [];
  }

  const base = `/branch/${branchId}`;

  const addIf = (name: string, path: string, icon: NavIconName, show: boolean) => {
    if (show) items.push({ name, href: `${base}${path}`, icon });
  };

  // Matrix
  if (key === "branch_manager") {
    addIf("Warehouse", "/warehouse", "Warehouse", true);
    addIf("Financials", "/financials", "BarChart3", true);
    addIf("Staffing", "/staffing", "Users", true);
    addIf("Payroll", "/payroll", "HandCoins", true);
    addIf("Vendors", "/vendors", "Truck", true);
    return items;
  }

  if (key === "branch_staff") {
    addIf("Warehouse", "/warehouse", "Warehouse", true);
    addIf("Financials", "/financials", "BarChart3", true);
    return items;
  }

  if (key === "warehouse_manager") {
    addIf("Warehouse", "/warehouse", "Warehouse", true);
    addIf("Vendors", "/vendors", "Truck", true);
    return items;
  }

  return items;
}
