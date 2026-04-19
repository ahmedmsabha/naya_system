import "server-only";

import { createClient } from "@/lib/supabase/server";

export type LegacyRole = "super_admin" | "warehouse_manager" | "branch_staff" | "viewer" | string;
export type AuthSource = "legacy" | "authz" | "hybrid";

type SupabaseServerClient = Awaited<ReturnType<typeof createClient>>;

type LegacyProfile = {
  role: LegacyRole | null;
  branchId: string | null;
};

type AuthzSnapshot = {
  available: boolean;
  organizationId: string | null;
  roleKeys: string[];
  permissionKeys: string[];
  branchScopeIds: string[];
  warehouseScopeIds: string[];
  hasData: boolean;
};

export type CurrentActor = {
  userId: string;
  email: string | null;
  organizationId: string | null;
  legacyRole: LegacyRole | null;
  legacyBranchId: string | null;
  isSuperAdmin: boolean;
  roleKeys: string[];
  permissionKeys: string[];
  branchScopeIds: string[];
  warehouseScopeIds: string[];
  authzAvailable: boolean;
  hasAuthzData: boolean;
  authSource: AuthSource;
};

function uniq(values: Array<string | null | undefined>): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))));
}

async function getLegacyProfile(
  supabase: SupabaseServerClient,
  userId: string
): Promise<LegacyProfile> {
  const { data, error } = await supabase
    .from("users")
    .select("role, branch_id")
    .eq("id", userId)
    .maybeSingle();

  if (error || !data) {
    return { role: null, branchId: null };
  }

  return {
    role: (data.role as LegacyRole | null) ?? null,
    branchId: data.branch_id ?? null,
  };
}

async function getAuthzSnapshot(
  supabase: SupabaseServerClient,
  userId: string
): Promise<AuthzSnapshot> {
  const assignmentsResult = await supabase
    .from("user_role_assignments")
    .select("organization_id, role_id, scope_type, branch_id, warehouse_id")
    .eq("user_id", userId);

  if (assignmentsResult.error) {
    return {
      available: false,
      organizationId: null,
      roleKeys: [],
      permissionKeys: [],
      branchScopeIds: [],
      warehouseScopeIds: [],
      hasData: false,
    };
  }

  const roleAssignments = assignmentsResult.data ?? [];
  const roleIds = uniq(roleAssignments.map((row) => row.role_id));

  let rolesById = new Map<string, string>();
  if (roleIds.length > 0) {
    const { data: roles, error: rolesError } = await supabase
      .from("roles")
      .select("id, key")
      .in("id", roleIds);

    if (rolesError) {
      return {
        available: false,
        organizationId: null,
        roleKeys: [],
        permissionKeys: [],
        branchScopeIds: [],
        warehouseScopeIds: [],
        hasData: false,
      };
    }

    rolesById = new Map((roles ?? []).map((role) => [role.id, role.key]));
  }

  const overridesResult = await supabase
    .from("user_permission_overrides")
    .select("permission_id, effect")
    .eq("user_id", userId);

  if (overridesResult.error) {
    return {
      available: false,
      organizationId: null,
      roleKeys: [],
      permissionKeys: [],
      branchScopeIds: [],
      warehouseScopeIds: [],
      hasData: false,
    };
  }

  let rolePermissionRows: Array<{ permission_id: string }> = [];
  if (roleIds.length > 0) {
    const rolePermissionResult = await supabase
      .from("role_permissions")
      .select("permission_id")
      .in("role_id", roleIds);

    if (rolePermissionResult.error) {
      return {
        available: false,
        organizationId: null,
        roleKeys: [],
        permissionKeys: [],
        branchScopeIds: [],
        warehouseScopeIds: [],
        hasData: false,
      };
    }

    rolePermissionRows = rolePermissionResult.data ?? [];
  }

  const overrideRows = overridesResult.data ?? [];
  const permissionIds = uniq([
    ...rolePermissionRows.map((row) => row.permission_id),
    ...overrideRows.map((row) => row.permission_id),
  ]);

  let permissionById = new Map<string, string>();
  if (permissionIds.length > 0) {
    const { data: permissions, error: permissionsError } = await supabase
      .from("permissions")
      .select("id, key")
      .in("id", permissionIds);

    if (permissionsError) {
      return {
        available: false,
        organizationId: null,
        roleKeys: [],
        permissionKeys: [],
        branchScopeIds: [],
        warehouseScopeIds: [],
        hasData: false,
      };
    }

    permissionById = new Map((permissions ?? []).map((permission) => [permission.id, permission.key]));
  }

  const allowedPermissions = new Set<string>();
  for (const row of rolePermissionRows) {
    const key = permissionById.get(row.permission_id);
    if (key) allowedPermissions.add(key);
  }

  for (const override of overrideRows) {
    const key = permissionById.get(override.permission_id);
    if (!key) continue;

    if (override.effect === "deny") {
      allowedPermissions.delete(key);
      continue;
    }

    allowedPermissions.add(key);
  }

  const userScopeResult = await supabase
    .from("user_scope_assignments")
    .select("organization_id, scope_type, branch_id, warehouse_id, can_read")
    .eq("user_id", userId)
    .eq("can_read", true);

  if (userScopeResult.error) {
    return {
      available: false,
      organizationId: null,
      roleKeys: [],
      permissionKeys: [],
      branchScopeIds: [],
      warehouseScopeIds: [],
      hasData: false,
    };
  }

  const readableScopes = userScopeResult.data ?? [];
  const orgId =
    roleAssignments.find((row) => row.organization_id)?.organization_id ??
    readableScopes.find((row) => row.organization_id)?.organization_id ??
    null;

  const branchScopeIds = uniq([
    ...roleAssignments.map((row) => row.branch_id),
    ...readableScopes.filter((row) => row.scope_type === "branch").map((row) => row.branch_id),
  ]);

  const warehouseScopeIds = uniq([
    ...roleAssignments.map((row) => row.warehouse_id),
    ...readableScopes.filter((row) => row.scope_type === "warehouse").map((row) => row.warehouse_id),
  ]);

  const roleKeys = uniq(roleAssignments.map((row) => rolesById.get(row.role_id)));
  const permissionKeys = uniq(Array.from(allowedPermissions));
  const hasData =
    roleAssignments.length > 0 ||
    readableScopes.length > 0 ||
    overrideRows.length > 0 ||
    permissionKeys.length > 0;

  return {
    available: true,
    organizationId: orgId,
    roleKeys,
    permissionKeys,
    branchScopeIds,
    warehouseScopeIds,
    hasData,
  };
}

export async function getCurrentActor(): Promise<CurrentActor | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [legacyProfile, authzSnapshot] = await Promise.all([
    getLegacyProfile(supabase, user.id),
    getAuthzSnapshot(supabase, user.id),
  ]);

  const roleKeys = authzSnapshot.roleKeys;
  const isSuperAdmin =
    roleKeys.includes("super_admin") || legacyProfile.role === "super_admin";

  const authSource: AuthSource =
    authzSnapshot.available && authzSnapshot.hasData
      ? legacyProfile.role || legacyProfile.branchId
        ? "hybrid"
        : "authz"
      : "legacy";

  return {
    userId: user.id,
    email: user.email ?? null,
    organizationId: authzSnapshot.organizationId,
    legacyRole: legacyProfile.role,
    legacyBranchId: legacyProfile.branchId,
    isSuperAdmin,
    roleKeys,
    permissionKeys: authzSnapshot.permissionKeys,
    branchScopeIds: authzSnapshot.branchScopeIds,
    warehouseScopeIds: authzSnapshot.warehouseScopeIds,
    authzAvailable: authzSnapshot.available,
    hasAuthzData: authzSnapshot.hasData,
    authSource,
  };
}

