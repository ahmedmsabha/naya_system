import "server-only";

import { getCurrentActor, type CurrentActor, type LegacyRole } from "@/lib/auth/actor";
import {
  permissionKey,
  type PermissionAction,
  type PermissionKey,
  type PermissionModule,
} from "@/lib/auth/permissions";

type AuthorizationMode = "legacy" | "compat" | "authz";

type AuthorizeInput = {
  module: PermissionModule;
  action: PermissionAction;
  branchId?: string | null;
  warehouseId?: string | null;
  throwOnFail?: boolean;
};

type AuthorizeResult = {
  ok: boolean;
  actor: CurrentActor | null;
  reason?: string;
};

const legacyRolePermissionMatrix: Record<string, PermissionKey[]> = {
  super_admin: [
    "dashboard.read",
    "dashboard.edit",
    "warehouse.read",
    "warehouse.edit",
    "vendors.read",
    "vendors.edit",
    "financials.read",
    "financials.edit",
    "staffing.read",
    "staffing.edit",
    "payroll.read",
    "payroll.edit",
    "alerts.read",
    "alerts.edit",
    "settings.read",
    "settings.edit",
  ],
  warehouse_manager: [
    "dashboard.read",
    "warehouse.read",
    "warehouse.edit",
    "vendors.read",
    "vendors.edit",
    "alerts.read",
  ],
  branch_staff: [
    "dashboard.read",
    "warehouse.read",
    "warehouse.edit",
    "vendors.read",
    "staffing.read",
    "alerts.read",
  ],
  viewer: [
    "dashboard.read",
    "warehouse.read",
    "vendors.read",
    "financials.read",
    "staffing.read",
    "payroll.read",
    "alerts.read",
    "settings.read",
  ],
};

function getAuthorizationMode(): AuthorizationMode {
  const value = process.env.AUTHZ_MODE?.toLowerCase();
  if (value === "legacy" || value === "authz") return value;
  return "compat";
}

function hasLegacyPermission(role: LegacyRole | null, key: PermissionKey): boolean {
  if (!role) return false;
  const permissionKeys = legacyRolePermissionMatrix[role];
  if (!permissionKeys) return false;
  return permissionKeys.includes(key);
}

function checkBranchScope(actor: CurrentActor, branchId?: string | null): boolean {
  if (!branchId || actor.isSuperAdmin) return true;

  if (actor.branchScopeIds.length > 0) {
    return actor.branchScopeIds.includes(branchId);
  }

  if (actor.legacyBranchId) {
    return actor.legacyBranchId === branchId;
  }

  return true;
}

function checkWarehouseScope(actor: CurrentActor, warehouseId?: string | null): boolean {
  if (!warehouseId || actor.isSuperAdmin) return true;
  if (actor.warehouseScopeIds.length === 0) return true;
  return actor.warehouseScopeIds.includes(warehouseId);
}

function authorizeLegacy(actor: CurrentActor, key: PermissionKey, input: AuthorizeInput): AuthorizeResult {
  if (!hasLegacyPermission(actor.legacyRole, key)) {
    return { ok: false, actor, reason: `Missing permission: ${key}` };
  }

  if (!checkBranchScope(actor, input.branchId)) {
    return { ok: false, actor, reason: "Branch scope denied" };
  }

  if (!checkWarehouseScope(actor, input.warehouseId)) {
    return { ok: false, actor, reason: "Warehouse scope denied" };
  }

  return { ok: true, actor };
}

function authorizeAuthz(actor: CurrentActor, key: PermissionKey, input: AuthorizeInput): AuthorizeResult {
  if (!actor.authzAvailable) {
    return { ok: false, actor, reason: "AuthZ tables are not available yet" };
  }

  if (!actor.hasAuthzData && !actor.isSuperAdmin) {
    return { ok: false, actor, reason: "No AuthZ assignments found for user" };
  }

  if (!actor.isSuperAdmin && !actor.permissionKeys.includes(key)) {
    return { ok: false, actor, reason: `Missing permission: ${key}` };
  }

  if (!checkBranchScope(actor, input.branchId)) {
    return { ok: false, actor, reason: "Branch scope denied" };
  }

  if (!checkWarehouseScope(actor, input.warehouseId)) {
    return { ok: false, actor, reason: "Warehouse scope denied" };
  }

  return { ok: true, actor };
}

export async function authorize(input: AuthorizeInput): Promise<AuthorizeResult> {
  const actor = await getCurrentActor();
  if (!actor) return { ok: false, actor: null, reason: "Unauthenticated" };

  const key = permissionKey(input.module, input.action);
  const mode = getAuthorizationMode();

  const result =
    mode === "legacy"
      ? authorizeLegacy(actor, key, input)
      : mode === "authz"
        ? authorizeAuthz(actor, key, input)
        : actor.authzAvailable && actor.hasAuthzData
          ? authorizeAuthz(actor, key, input)
          : authorizeLegacy(actor, key, input);

  if (!result.ok && input.throwOnFail) {
    throw new Error(result.reason ?? "Unauthorized");
  }

  return result;
}

export async function assertAuthorized(input: AuthorizeInput): Promise<CurrentActor> {
  const result = await authorize({ ...input, throwOnFail: false });
  if (!result.ok || !result.actor) {
    throw new Error(result.reason ?? "Unauthorized");
  }
  return result.actor;
}

