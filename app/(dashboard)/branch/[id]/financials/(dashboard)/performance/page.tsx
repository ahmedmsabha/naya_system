import { FinancialPerformanceSection } from '@/components/finance/financials-dashboard/FinancialPerformanceSection';
import { FinancialsHubPage } from '@/components/finance/financials-dashboard/FinancialsHubPage';

export default async function FinancialsPerformancePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  return (
    <FinancialsHubPage params={params} searchParams={searchParams} Section={FinancialPerformanceSection} />
  );
}
