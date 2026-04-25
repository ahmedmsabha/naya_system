import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { PermissionAction, PermissionModule } from "@/lib/auth/permissions";

/**
 * Module access for RBAC checks (aligns with `PermissionModule` in `permissions.ts`).
 */
export type AuthModule = PermissionModule;
export type AuthAction = PermissionAction;

export type RbacUserContext = {
  userId: string;
  email: string | null;
  role: string;
  branchId: string | null;
};

export type AuthorizeInput = {
  module: AuthModule;
  action: AuthAction;
  branchId?: string | null;
  /** Reserved for future scope checks; not used in the current JWT + branch matrix. */
  warehouseId?: string | null;
  throwOnFail?: boolean;
};

export type AuthorizeResult =
  | { ok: true; actor: RbacUserContext }
  | { ok: false; reason: string; actor: RbacUserContext | null };

const BRANCH_MANAGER_MODULES: ReadonlySet<AuthModule> = new Set([
  "dashboard",
  "warehouse",
  "financials",
  "staffing",
  "payroll",
  "vendors",
]);

const BRANCH_STAFF_MODULES: ReadonlySet<AuthModule> = new Set(["warehouse", "financials"]);

const WAREHOUSE_MANAGER_MODULES: ReadonlySet<AuthModule> = new Set(["warehouse", "vendors"]);

/**
 * When `true`, branch layout helpers may redirect unknown `branch_id` in the URL to the first DB branch
 * (dev / single-tenant convenience). It does not bypass `authorize()` for mutations.
 * - `false` / `0` → do not use that redirect fallback.
 * - unset or any other value → allow fallback.
 */
export function isSingleTenantAdminBypass(): boolean {
  const raw = process.env.AUTH_SINGLE_TENANT_ADMIN?.toLowerCase();
  if (raw === "false" || raw === "0") return false;
  return true;
}

function normalizeUuidString(value: string | null | undefined): string | null {
  if (value == null || value === "") return null;
  return value.trim();
}

function readUserMetadata(user: {
  user_metadata?: Record<string, unknown> | null;
}): { role: string; branchId: string | null } {
  const meta = user.user_metadata ?? {};
  const role = typeof meta.role === "string" ? meta.role : "";
  const branchId = normalizeUuidString(
    typeof meta.branch_id === "string" ? meta.branch_id : null
  );
  return { role, branchId };
}

function moduleAllowedForRole(role: string, module: AuthModule): boolean {
  switch (role) {
    case "branch_manager":
      return BRANCH_MANAGER_MODULES.has(module);
    case "branch_staff":
      return BRANCH_STAFF_MODULES.has(module);
    case "warehouse_manager":
      return WAREHOUSE_MANAGER_MODULES.has(module);
    default:
      return false;
  }
}

/**
 * Server-side authorization using Supabase Auth session and `user_metadata.role` /
 * `user_metadata.branch_id` (must match RLS expectations).
 */
export async function authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    const failed: AuthorizeResult = { ok: false, reason: "Unauthenticated", actor: null };
    if (input.throwOnFail) throw new Error(failed.reason);
    return failed;
  }

  const { role, branchId: tokenBranchId } = readUserMetadata(user);
  const actor: RbacUserContext = {
    userId: user.id,
    email: user.email ?? null,
    role,
    branchId: tokenBranchId,
  };

  if (role === "super_admin") {
    return { ok: true, actor };
  }

  const requestedBranch = normalizeUuidString(
    input.branchId === undefined || input.branchId === null
      ? null
      : String(input.branchId)
  );

  if (requestedBranch !== null) {
    if (!tokenBranchId || requestedBranch !== tokenBranchId) {
      const failed: AuthorizeResult = { ok: false, reason: "Branch mismatch", actor };
      if (input.throwOnFail) throw new Error(failed.reason);
      return failed;
    }
  }

  if (!moduleAllowedForRole(role, input.module)) {
    const failed: AuthorizeResult = {
      ok: false,
      reason: "Insufficient permissions for this module",
      actor,
    };
    if (input.throwOnFail) throw new Error(failed.reason);
    return failed;
  }

  return { ok: true, actor };
}

export async function assertAuthorized(input: AuthorizeInput): Promise<RbacUserContext> {
  const result = await authorize({ ...input, throwOnFail: false });
  if (result.ok) {
    return result.actor;
  }
  throw new Error(result.reason);
}
