import { getCurrentActor } from "@/lib/auth/actor";
import { redirect } from "next/navigation";

type BranchLayoutProps = {
  children: React.ReactNode;
  params: Promise<{ id: string }>;
};

/**
 * Enforces that non–super-admin users can only use their own `branch_id` in the URL.
 * Super admins may open any branch for oversight.
 */
export default async function BranchIdLayout({ children, params }: BranchLayoutProps) {
  const { id } = await params;
  const actor = await getCurrentActor();

  if (!actor) {
    redirect("/login");
  }

  if (actor.isSuperAdmin) {
    return <>{children}</>;
  }

  const userBranch = actor.legacyBranchId;
  if (!userBranch) {
    redirect("/login?error=Unauthorized");
  }
  if (id !== userBranch) {
    redirect(`/branch/${userBranch}`);
  }

  return <>{children}</>;
}
