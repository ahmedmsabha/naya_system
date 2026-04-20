import { RevenueUnitSection } from '@/components/finance/financials-dashboard/RevenueUnitSection';
import { FinancialsHubPage } from '@/components/finance/financials-dashboard/FinancialsHubPage';

export default async function FinancialsRevenuePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  return (
    <FinancialsHubPage params={params} searchParams={searchParams} Section={RevenueUnitSection} />
  );
}
