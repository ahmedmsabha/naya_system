import { ModuleBranchPicker } from "@/app/(dashboard)/_components/ModuleBranchPicker";
import { monthKeyNow } from "@/lib/domain/date";

export default async function FinancialsLandingPage() {
  const period = monthKeyNow();
  return (
    <ModuleBranchPicker
      title="Financials"
      subtitle="Select a branch to open the executive P&L workspace."
      buildHref={(branchId) => `/branch/${branchId}/financials/performance?period=${period}`}
      emptyHint="No branches found. Add branches in Supabase to access financial reports."
    />
  );
}

