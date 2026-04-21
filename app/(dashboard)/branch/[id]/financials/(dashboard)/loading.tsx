'use client';

export default function BranchFinancialsDashboardLoading() {
  return (
    <div className="max-w-7xl w-full" dir="ltr">
      <div className="animate-pulse space-y-4">
        <div className="h-10 w-72 rounded-2xl bg-gray-100" />
        <div className="h-4 w-96 rounded-xl bg-gray-100" />
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <div className="h-28 rounded-[2rem] bg-gray-100" />
          <div className="h-28 rounded-[2rem] bg-gray-100" />
          <div className="h-28 rounded-[2rem] bg-gray-100" />
        </div>
        <div className="h-[420px] rounded-[2rem] bg-gray-100" />
      </div>
    </div>
  );
}

