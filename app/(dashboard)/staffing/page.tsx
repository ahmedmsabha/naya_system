import { ModuleBranchPicker } from "@/app/(dashboard)/_components/ModuleBranchPicker";
import { monthKeyNow } from "@/lib/domain/date";

export default async function StaffingLandingPage() {
  const period = monthKeyNow();
  return (
    <ModuleBranchPicker
      title="Staffing"
      subtitle="Select a branch to manage staffing snapshots and payroll synchronization."
      buildHref={(branchId) => `/branch/${branchId}/staffing?period=${period}`}
      emptyHint="No branches found. Add branches in Supabase to access staffing operations."
    />
  );
}

