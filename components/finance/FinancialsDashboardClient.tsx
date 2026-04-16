'use client';

import { useMemo, useState } from 'react';
import { ExecutiveFinancialDashboard } from '@/components/finance/ExecutiveFinancialDashboard';
import { FinancialsEnhancementPanel } from '@/components/finance/FinancialsEnhancementPanel';
import { MonthlyPnLTable } from '@/components/finance/MonthlyPnLTable';
import type { MonthlyPnLDeductionCategory, MonthlyPnLExpenseCategory } from '@/lib/finance/monthly-pnl';

type ExpenseRow = {
  category: MonthlyPnLExpenseCategory;
  amount: number;
  receiptUrl: string | null;
  readOnly: boolean;
  helperLinkHref?: string;
  helperLinkLabel?: string;
};

type DeductionValues = Record<MonthlyPnLDeductionCategory, number>;

type FinancialsDashboardClientProps = {
  branchId: string;
  branchName: string;
  monthLabel: string;
  selectedPeriod: string;
  monthHrefPrev: string;
  monthHrefNext: string;
  varianceHref: string;
  vendorsHref: string;
  grossSales: number;
  netSales: number;
  cogs: number;
  laborCost: number;
  operationsCost: number;
  ebitda: number;
  deliverySales: number;
  dineInSales: number;
  averageTicket: number;
  weeklySalesSeries: Array<{ label: string; delivery: number; takeaway: number }>;
  insights: string[];
  recipes: Array<{ id: string; name: string; sellingPrice: number }>;
  initialRows: ExpenseRow[];
  initialDeductions: DeductionValues;
};

type StatusTone = 'emerald' | 'rose' | 'amber';

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function badgeMeta(actualPct: number, targetPct: number): { label: 'ON TARGET' | 'CRITICAL INCREASE' | 'UNDER BUDGET'; tone: StatusTone } {
  if (actualPct > targetPct * 1.1) return { label: 'CRITICAL INCREASE', tone: 'rose' };
  if (actualPct < targetPct * 0.85) return { label: 'UNDER BUDGET', tone: 'amber' };
  return { label: 'ON TARGET', tone: 'emerald' };
}

export function FinancialsDashboardClient({
  branchId,
  branchName,
  monthLabel,
  selectedPeriod,
  monthHrefPrev,
  monthHrefNext,
  varianceHref,
  vendorsHref,
  grossSales,
  netSales,
  cogs,
  laborCost,
  operationsCost,
  ebitda,
  deliverySales,
  dineInSales,
  averageTicket,
  weeklySalesSeries,
  insights,
  recipes,
  initialRows,
  initialDeductions,
}: FinancialsDashboardClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [deductions, setDeductions] = useState(initialDeductions);

  const dynamicMetrics = useMemo(() => {
    const totalDeductions =
      deductions['Square Fees'] +
      deductions.TX +
      deductions['Delivery Fee'] +
      deductions.Marketing;
    const totalExpenses = rows.reduce((sum, row) => sum + row.amount, 0);
    const nextNetSales = grossSales - totalDeductions;
    const nextCogs = rows
      .filter((row) =>
        ['US Foods', 'Lenard Paper', 'PFG', "Keany's", 'Bread', 'Warehouse'].includes(row.category),
      )
      .reduce((sum, row) => sum + row.amount, 0);
    const nextLabor = rows.find((row) => row.category === 'Labor')?.amount ?? laborCost;
    const nextOperations = Math.max(0, totalExpenses - nextCogs - nextLabor);
    const nextEbitda = nextNetSales - nextCogs - nextLabor - nextOperations;
    return {
      totalDeductions,
      totalExpenses,
      netSales: nextNetSales,
      cogs: nextCogs,
      labor: nextLabor,
      operations: nextOperations,
      ebitda: nextEbitda,
    };
  }, [deductions, grossSales, laborCost, rows]);

  const matrixRows = [
    {
      label: 'GROSS SALES',
      amount: grossSales,
      pct: 100,
      status: { label: 'ON TARGET' as const, tone: 'emerald' as const },
    },
    {
      label: 'NET SALES',
      amount: dynamicMetrics.netSales,
      pct: percentage(dynamicMetrics.netSales, grossSales),
      status: dynamicMetrics.netSales >= grossSales * 0.92
        ? { label: 'ON TARGET' as const, tone: 'emerald' as const }
        : { label: 'CRITICAL INCREASE' as const, tone: 'rose' as const },
    },
    {
      label: 'COGS (INVENTORY / VENDORS)',
      amount: dynamicMetrics.cogs,
      pct: percentage(dynamicMetrics.cogs, grossSales),
      status: badgeMeta(percentage(dynamicMetrics.cogs, grossSales), 30),
    },
    {
      label: 'GROSS PROFIT',
      amount: dynamicMetrics.netSales - dynamicMetrics.cogs,
      pct: percentage(dynamicMetrics.netSales - dynamicMetrics.cogs, grossSales),
      status: dynamicMetrics.netSales - dynamicMetrics.cogs >= grossSales * 0.45
        ? { label: 'ON TARGET' as const, tone: 'emerald' as const }
        : { label: 'CRITICAL INCREASE' as const, tone: 'rose' as const },
    },
    {
      label: 'STAFFING',
      amount: dynamicMetrics.labor,
      pct: percentage(dynamicMetrics.labor, grossSales),
      status: badgeMeta(percentage(dynamicMetrics.labor, grossSales), 25),
    },
    {
      label: 'OPERATIONS',
      amount: dynamicMetrics.operations,
      pct: percentage(dynamicMetrics.operations, grossSales),
      status: badgeMeta(percentage(dynamicMetrics.operations, grossSales), 20),
    },
    {
      label: 'EBITDA',
      amount: dynamicMetrics.ebitda,
      pct: percentage(dynamicMetrics.ebitda, grossSales),
      status: dynamicMetrics.ebitda >= grossSales * 0.15
        ? { label: 'ON TARGET' as const, tone: 'emerald' as const }
        : dynamicMetrics.ebitda >= grossSales * 0.1
          ? { label: 'UNDER BUDGET' as const, tone: 'amber' as const }
          : { label: 'CRITICAL INCREASE' as const, tone: 'rose' as const },
    },
  ];

  return (
    <section className="space-y-8 pb-16" dir="ltr">
      <ExecutiveFinancialDashboard
        branchName={branchName}
        monthLabel={monthLabel}
        selectedPeriod={selectedPeriod}
        monthHrefPrev={monthHrefPrev}
        monthHrefNext={monthHrefNext}
        varianceHref={varianceHref}
        vendorsHref={vendorsHref}
        accountantHref="/accountant"
        grossSales={grossSales}
        totalDeductions={dynamicMetrics.totalDeductions}
        netTotal={dynamicMetrics.netSales}
        operatingExpenses={dynamicMetrics.totalExpenses}
        pnl={dynamicMetrics.ebitda}
        insights={insights}
        kpis={[
          {
            label: 'Net Margin',
            value: percentage(dynamicMetrics.ebitda, grossSales),
            target: 18,
            description: 'Net profit as a share of gross sales.',
            tone:
              percentage(dynamicMetrics.ebitda, grossSales) >= 18
                ? 'good'
                : percentage(dynamicMetrics.ebitda, grossSales) >= 12
                  ? 'warning'
                  : 'danger',
          },
          {
            label: 'Food Cost %',
            value: percentage(dynamicMetrics.cogs, grossSales),
            target: 30,
            description: 'Vendors and warehouse spend as a share of gross sales.',
            tone:
              percentage(dynamicMetrics.cogs, grossSales) <= 30
                ? 'good'
                : percentage(dynamicMetrics.cogs, grossSales) <= 35
                  ? 'warning'
                  : 'danger',
          },
          {
            label: 'Labor Cost %',
            value: percentage(dynamicMetrics.labor, grossSales),
            target: 25,
            description: 'Payroll load sourced from monthly compensation.',
            tone:
              percentage(dynamicMetrics.labor, grossSales) <= 25
                ? 'good'
                : percentage(dynamicMetrics.labor, grossSales) <= 30
                  ? 'warning'
                  : 'danger',
          },
        ]}
        pnlEntryTable={
          <MonthlyPnLTable
            branchId={branchId}
            monthPeriod={selectedPeriod}
            totalCollected={grossSales}
            initialRows={initialRows}
            initialDeductions={initialDeductions}
            onDataChange={(payload) => {
              setRows(payload.rows);
              setDeductions(payload.deductions);
            }}
          />
        }
      />

      <FinancialsEnhancementPanel
        branchId={branchId}
        selectedPeriod={selectedPeriod}
        varianceHref={varianceHref}
        vendorsHref={vendorsHref}
        recipes={recipes}
        deliverySales={deliverySales}
        dineInSales={dineInSales}
        averageTicket={averageTicket}
        weeklySalesSeries={weeklySalesSeries}
        matrixRows={matrixRows}
        baseline={{
          netSales,
          cogs,
          operationsCost,
          ebitda,
        }}
      />
    </section>
  );
}
