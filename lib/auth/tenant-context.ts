export type TenantContext = {
  branchId: string | null;
  warehouseId: string | null;
};

const branchPathRegex = /^\/branch\/([^/]+)(?:\/|$)/;
const warehousePathRegex = /^\/warehouse\/([^/]+)(?:\/|$)/;

export function resolveTenantContextFromPath(pathname: string): TenantContext {
  const branchMatch = pathname.match(branchPathRegex);
  const warehouseMatch = pathname.match(warehousePathRegex);

  return {
    branchId: branchMatch?.[1] ?? null,
    warehouseId: warehouseMatch?.[1] ?? null,
  };
}

