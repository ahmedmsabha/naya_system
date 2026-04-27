import "server-only";

import type { CurrentActor } from "@/lib/auth/actor";

/** Receiving at destination branch: branch staff, manager, or super admin. */
export function canReceiveTransfer(actor: CurrentActor | null): boolean {
  if (!actor) return false;
  if (actor.isSuperAdmin) return true;
  if (actor.legacyRole === "branch_manager" || actor.legacyRole === "branch_staff") {
    return true;
  }
  if (actor.roleKeys.includes("branch_manager") || actor.roleKeys.includes("branch_staff")) {
    return true;
  }
  return false;
}
