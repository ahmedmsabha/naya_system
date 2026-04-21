import "server-only";

import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSingleTenantAdminBypass } from "@/lib/auth/authorize";

/**
 * Resolves a branch row for dashboard routes. In single-tenant mode, an unknown `branchId` in the URL
 * redirects to the first branch in the database so placeholder UUIDs and stale links still work.
 */
export async function requireBranchRow(
  branchId: string,
  buildRedirectUrl: (canonicalBranchId: string) => string,
): Promise<{ id: string; name: string }> {
  const supabase = await createClient();
  const { data: branch } = await supabase
    .from("branches")
    .select("id, name")
    .eq("id", branchId)
    .maybeSingle();

  if (branch?.id) {
    return { id: branch.id, name: String(branch.name ?? "") };
  }

  if (isSingleTenantAdminBypass()) {
    const { data: first } = await supabase
      .from("branches")
      .select("id, name")
      .order("name")
      .limit(1)
      .maybeSingle();
    if (first?.id) {
      redirect(buildRedirectUrl(first.id));
    }
  }

  notFound();
}
