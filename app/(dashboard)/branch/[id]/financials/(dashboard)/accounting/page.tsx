import { AccountingCenterSection } from '@/components/finance/financials-dashboard/AccountingCenterSection';
import { FinancialsHubPage } from '@/components/finance/financials-dashboard/FinancialsHubPage';

export default async function FinancialsAccountingPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  return (
    <FinancialsHubPage params={params} searchParams={searchParams} Section={AccountingCenterSection} />
  );
}
