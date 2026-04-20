'use client';

import { FinancialsEnhancementPanel } from '@/components/finance/FinancialsEnhancementPanel';
import { useFinancialsDashboard } from '@/components/finance/financials-dashboard/FinancialsDashboardContext';

export function FinancialsEnhancementBlock() {
  const ctx = useFinancialsDashboard();
  const varianceHref = `/branch/${ctx.branchId}/financials/variance?period=${encodeURIComponent(ctx.selectedPeriod)}`;
  const vendorsHref = `/branch/${ctx.branchId}/vendors?period=${encodeURIComponent(ctx.selectedPeriod)}`;

  return (
    <FinancialsEnhancementPanel
      branchId={ctx.branchId}
      selectedPeriod={ctx.selectedPeriod}
      varianceHref={varianceHref}
      vendorsHref={vendorsHref}
      recipes={ctx.recipes}
      deliverySales={ctx.deliverySales}
      dineInSales={ctx.dineInSales}
      averageTicket={ctx.averageTicket}
      weeklySalesSeries={ctx.weeklySalesSeries}
      matrixRows={ctx.matrixRows}
      baseline={ctx.pnlBaseline}
    />
  );
}
