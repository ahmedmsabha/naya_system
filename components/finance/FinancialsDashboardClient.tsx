'use client';

import { useMemo, useState } from 'react';
import { ExecutiveFinancialDashboard } from '@/components/finance/ExecutiveFinancialDashboard';
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
  grossSales: number;
  initialRows: ExpenseRow[];
  initialDeductions: DeductionValues;
  insights: string[];
};

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function calcMetrics(grossSales: number, rows: ExpenseRow[], deductions: DeductionValues) {
  const totalDeductions =
    deductions['Square Fees'] +
    deductions.TX +
    deductions['Delivery Fee'] +
    deductions.Marketing;
  const totalExpenses = rows.reduce((sum, row) => sum + row.amount, 0);
  const netTotal = grossSales - totalDeductions;
  const pnl = netTotal - totalExpenses;
  const vendorCogs = rows
    .filter((row) =>
      ['US Foods', 'Lenard Paper', 'PFG', "Keany's", 'Bread', 'Warehouse'].includes(row.category),
    )
    .reduce((sum, row) => sum + row.amount, 0);
  const laborCost = rows.find((row) => row.category === 'Labor')?.amount ?? 0;

  return {
    totalDeductions,
    totalExpenses,
    netTotal,
    pnl,
    vendorCogs,
    laborCost,
    netMargin: percentage(pnl, grossSales),
    foodCostPct: percentage(vendorCogs, grossSales),
    laborCostPct: percentage(laborCost, grossSales),
  };
}

export function FinancialsDashboardClient({
  branchId,
  branchName,
  monthLabel,
  selectedPeriod,
  monthHrefPrev,
  monthHrefNext,
  varianceHref,
  grossSales,
  initialRows,
  initialDeductions,
  insights,
}: FinancialsDashboardClientProps) {
  const [rows, setRows] = useState(initialRows);
  const [deductions, setDeductions] = useState(initialDeductions);

  const metrics = useMemo(() => calcMetrics(grossSales, rows, deductions), [deductions, grossSales, rows]);

  return (
    <ExecutiveFinancialDashboard
      branchName={branchName}
      monthLabel={monthLabel}
      selectedPeriod={selectedPeriod}
      monthHrefPrev={monthHrefPrev}
      monthHrefNext={monthHrefNext}
      varianceHref={varianceHref}
      grossSales={grossSales}
      totalDeductions={metrics.totalDeductions}
      netTotal={metrics.netTotal}
      operatingExpenses={metrics.totalExpenses}
      pnl={metrics.pnl}
      insights={insights}
      kpis={[
        {
          label: 'Net Margin',
          value: metrics.netMargin,
          target: 18,
          description: 'Net profit as a share of gross sales.',
          tone:
            metrics.netMargin >= 18
              ? 'good'
              : metrics.netMargin >= 12
                ? 'warning'
                : 'danger',
        },
        {
          label: 'Food Cost %',
          value: metrics.foodCostPct,
          target: 30,
          description: 'Vendors and warehouse spend as a share of gross sales.',
          tone:
            metrics.foodCostPct <= 30
              ? 'good'
              : metrics.foodCostPct <= 35
                ? 'warning'
                : 'danger',
        },
        {
          label: 'Labor Cost %',
          value: metrics.laborCostPct,
          target: 25,
          description: 'Payroll load sourced from monthly compensation.',
          tone:
            metrics.laborCostPct <= 25
              ? 'good'
              : metrics.laborCostPct <= 30
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
  );
}
