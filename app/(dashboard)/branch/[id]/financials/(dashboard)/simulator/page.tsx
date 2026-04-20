import { DecisionSimulatorSection } from '@/components/finance/financials-dashboard/DecisionSimulatorSection';
import { FinancialsHubPage } from '@/components/finance/financials-dashboard/FinancialsHubPage';

export default async function FinancialsSimulatorPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
}) {
  return (
    <FinancialsHubPage params={params} searchParams={searchParams} Section={DecisionSimulatorSection} />
  );
}
