import { ModuleBranchPicker } from "@/app/(dashboard)/_components/ModuleBranchPicker";

export default async function WarehouseLandingPage() {
  return (
    <ModuleBranchPicker
      title="Warehouse"
      subtitle="Select a branch to open inventory, schedule, and invoice controls."
      buildHref={(branchId) => `/branch/${branchId}/warehouse`}
      emptyHint="No branches found. Add branches in Supabase to access warehouse operations."
    />
  );
}

