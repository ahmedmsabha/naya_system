export const permissionModules = [
  "dashboard",
  "warehouse",
  "vendors",
  "financials",
  "staffing",
  "payroll",
  "alerts",
  "settings",
] as const;

export type PermissionModule = (typeof permissionModules)[number];
export type PermissionAction = "read" | "edit";
export type PermissionKey = `${PermissionModule}.${PermissionAction}`;

export function permissionKey(module: PermissionModule, action: PermissionAction): PermissionKey {
  return `${module}.${action}`;
}

