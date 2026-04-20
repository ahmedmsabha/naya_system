import { InvestorPortalSection } from '@/components/finance/financials-dashboard/InvestorPortalSection';
import { FinancialsHubPage } from '@/components/finance/financials-dashboard/FinancialsHubPage';

export default async function FinancialsInvestorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  return (
    <FinancialsHubPage params={params} searchParams={searchParams} Section={InvestorPortalSection} />
  );
}
