import "server-only";

import { redirect } from "next/navigation";
import { authorize } from "@/lib/auth/authorize";
import { getCurrentActor } from "@/lib/auth/actor";

/**
 * The branch “home” page (`/branch/:id`) loads executive KPIs and requires
 * `dashboard` read. Roles such as `branch_staff` and `warehouse_manager` do not
 * have that module — they would otherwise hit `notFound()`. Send them to warehouse.
 */
export async function requireBranchHubAccessOrRedirect(branchId: string): Promise<void> {
  const access = await authorize({ module: "dashboard", action: "read", branchId });
  if (access.ok) return;
  redirect(`/branch/${branchId}/warehouse`);
}

/**
 * On the enterprise branch picker (`/`), users who are not allowed the executive
 * hub should land in their branch warehouse instead of a 404 on `/branch/:id`.
 */
export async function redirectNonExecutiveUsersToBranchWarehouse(): Promise<void> {
  const actor = await getCurrentActor();
  if (!actor || actor.isSuperAdmin || !actor.legacyBranchId) return;

  const access = await authorize({
    module: "dashboard",
    action: "read",
    branchId: actor.legacyBranchId,
  });
  if (access.ok) return;

  redirect(`/branch/${actor.legacyBranchId}/warehouse`);
}
