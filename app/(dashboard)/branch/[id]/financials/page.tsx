import { FinancialsDashboardClient } from '@/components/finance/FinancialsDashboardClient';
import {
  monthKeyNow,
  monthLabel,
  parsePeriod,
} from '@/lib/domain/date';
import { getFinancialsDashboardData } from './queries';

export const dynamic = 'force-dynamic';

export default async function BranchFinancialsPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const selectedPeriod = parsePeriod(sp.period, monthKeyNow());
  const data = await getFinancialsDashboardData(id, selectedPeriod);
  const currentMonthLabel = monthLabel(selectedPeriod);

  return (
    <div className="w-full" dir="ltr">
      <FinancialsDashboardClient
        branchId={id}
        branchName={data.branchName}
        monthLabel={currentMonthLabel}
        selectedPeriod={selectedPeriod}
        monthHrefPrev={data.monthHrefPrev}
        monthHrefNext={data.monthHrefNext}
        varianceHref={`/branch/${id}/financials/variance?period=${selectedPeriod}`}
        vendorsHref={`/branch/${id}/vendors?period=${selectedPeriod}`}
        grossSales={data.grossSales}
        netSales={data.netSales}
        cogs={data.cogs}
        laborCost={data.laborCost}
        operationsCost={data.operationsCost}
        ebitda={data.ebitda}
        deliverySales={data.deliverySales}
        dineInSales={data.dineInSales}
        averageTicket={data.averageTicket}
        weeklySalesSeries={data.weeklySalesSeries}
        insights={data.insights}
        recipes={data.recipes}
        initialRows={data.initialRows}
        initialDeductions={data.initialDeductions}
      />
    </div>
  );
}
