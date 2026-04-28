import "server-only";

import type { CurrentActor } from "@/lib/auth/actor";

/**
 * Commissary shipping (dispatch, labels). `authorize()` already ties actions to the user’s
 * `branch_id`, so a restaurant branch manager cannot act on the commissary.
 *
 * - **warehouse_manager** — primary ops & fulfillment role
 * - **branch_manager** — commissary GM / same powers here as warehouse lead
 * - **branch_staff** — not included; use warehouse for receiving inventory / financials only
 */
export function canManageFulfillment(actor: CurrentActor | null): boolean {
  if (!actor) return false;
  if (actor.isSuperAdmin) return true;
  if (actor.legacyRole === "warehouse_manager" || actor.roleKeys.includes("warehouse_manager")) {
    return true;
  }
  if (actor.legacyRole === "branch_manager" || actor.roleKeys.includes("branch_manager")) {
    return true;
  }
  return false;
}
