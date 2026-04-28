import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentActor, type CurrentActor } from "@/lib/auth/actor";

/** Serializable for server → client; mapped to Lucide icons in the sidebar client. */
export const NAV_ICON_NAMES = [
  "LayoutDashboard",
  "Target",
  "BarChart3",
  "Warehouse",
  "Package",
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
  /** In-transit inbound count for Orders, etc. */
  badgeCount?: number;
};

/**
 * Deduplicate actor fetch + nav build in one request (Sidebar + TopHeader + layout if needed).
 */
export const getCachedDashboardNav = cache(async (): Promise<DashboardNavItem[]> => {
  const actor = await getCurrentActor();
  return buildNavItemsForActor(actor);
});

async function countInboundInTransitForBranch(branchId: string): Promise<number> {
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("transfers")
    .select("id", { count: "exact", head: true })
    .eq("to_branch_id", branchId)
    .eq("status", "in_transit");
  if (error) {
    return 0;
  }
  return count ?? 0;
}

/**
 * For branch users, module paths are under `/branch/:id/...` when `branchId` is set;
 * `super_admin` uses global entry screens where they exist in this app.
 */
function buildBaseNavItems(actor: CurrentActor | null): DashboardNavItem[] {
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
      { name: "Team Settings", href: "/settings/team", icon: "Settings" },
    );
    items.push(
      { name: "Financials", href: "/financials", icon: "BarChart3" },
      { name: "Warehouse", href: "/warehouse", icon: "Warehouse" },
      { name: "Staffing", href: "/staffing", icon: "Users" },
    );
    return items;
  }

  if (!branchId) {
    return [];
  }

  const base = `/branch/${branchId}`;

  const addIf = (name: string, path: string, icon: NavIconName, show: boolean) => {
    if (show) items.push({ name, href: `${base}${path}`, icon });
  };

  if (key === "branch_manager") {
    addIf("Warehouse", "/warehouse", "Warehouse", true);
    addIf("Orders", "/orders", "Package", true);
    addIf("Financials", "/financials", "BarChart3", true);
    addIf("Staffing", "/staffing", "Users", true);
    addIf("Payroll", "/payroll", "HandCoins", true);
    addIf("Vendors", "/vendors", "Truck", true);
    return items;
  }

  if (key === "branch_staff") {
    addIf("Warehouse", "/warehouse", "Warehouse", true);
    addIf("Orders", "/orders", "Package", true);
    addIf("Financials", "/financials", "BarChart3", true);
    return items;
  }

  if (key === "warehouse_manager") {
    addIf("Warehouse", "/warehouse", "Warehouse", true);
    addIf("Orders", "/orders", "Package", true);
    addIf("Vendors", "/vendors", "Truck", true);
    return items;
  }

  return items;
}

export async function buildNavItemsForActor(actor: CurrentActor | null): Promise<DashboardNavItem[]> {
  const baseItems = buildBaseNavItems(actor);
  if (!actor?.legacyBranchId) {
    return baseItems;
  }
  const inTransit = await countInboundInTransitForBranch(actor.legacyBranchId);
  return baseItems.map((item) => {
    if (item.name === "Orders" && item.href.includes("/orders") && !item.href.includes("scan")) {
      return { ...item, badgeCount: inTransit };
    }
    return item;
  });
}

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

/** Synchronous list without badges — only for tests or when counts are not needed. */
export function getDashboardNavItems(actor: CurrentActor | null): DashboardNavItem[] {
  return buildBaseNavItems(actor);
}
