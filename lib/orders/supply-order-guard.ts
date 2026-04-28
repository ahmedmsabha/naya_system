import "server-only";

import type { CurrentActor } from "@/lib/auth/actor";

/** Branch supply orders: allowed for super admins and branch managers only. */
export function canCreateSupplyOrder(actor: CurrentActor | null): boolean {
  if (!actor) return false;
  return (
    actor.isSuperAdmin ||
    actor.legacyRole === "branch_manager" ||
    actor.roleKeys.includes("branch_manager")
  );
}
