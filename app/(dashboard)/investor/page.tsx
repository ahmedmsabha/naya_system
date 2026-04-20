import { ModuleBranchPicker } from "@/app/(dashboard)/_components/ModuleBranchPicker";
import { monthKeyNow } from "@/lib/domain/date";

export default async function InvestorLandingPage() {
  const period = monthKeyNow();
  return (
    <ModuleBranchPicker
      title="Investor View"
      subtitle="Select a branch to open investor-grade financial intelligence."
      buildHref={(branchId) => `/branch/${branchId}/financials/performance?period=${period}`}
      emptyHint="No branches found. Add branches in Supabase to access investor views."
    />
  );
}

