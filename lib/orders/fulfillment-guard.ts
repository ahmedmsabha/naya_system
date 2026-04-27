import "server-only";

import type { CurrentActor } from "@/lib/auth/actor";

/** Commissary fulfillment: warehouse manager or super admin only. */
export function canManageFulfillment(actor: CurrentActor | null): boolean {
  if (!actor) return false;
  return (
    actor.isSuperAdmin ||
    actor.legacyRole === "warehouse_manager" ||
    actor.roleKeys.includes("warehouse_manager")
  );
}
