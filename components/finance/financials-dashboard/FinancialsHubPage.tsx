import { getFinancialsDashboardData } from '@/app/(dashboard)/branch/[id]/financials/queries';
import { monthKeyNow, parsePeriod } from '@/lib/domain/date';
import { FinancialsDashboardProvider } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';
import { FinancialsEnhancementBlock } from '@/components/finance/financials-dashboard/FinancialsEnhancementBlock';
import { FinancialsLayoutShell } from '@/components/finance/financials-dashboard/FinancialsLayoutShell';
import type { ComponentType } from 'react';

export async function FinancialsHubPage({
  params,
  searchParams,
  Section,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ period?: string | string[] }>;
  Section: ComponentType;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const raw = sp.period;
  const periodParam = Array.isArray(raw) ? raw[0] : raw;
  const selectedPeriod = parsePeriod(periodParam, monthKeyNow());
  const data = await getFinancialsDashboardData(id, selectedPeriod);

  return (
    <FinancialsDashboardProvider initialData={data}>
      <div className="w-full space-y-8 pb-16" dir="ltr">
        <FinancialsLayoutShell>
          <Section />
        </FinancialsLayoutShell>
        <FinancialsEnhancementBlock />
      </div>
    </FinancialsDashboardProvider>
  );
}
