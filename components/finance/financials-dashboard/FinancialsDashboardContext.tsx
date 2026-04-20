'use client';

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import type { FinancialsDashboardData } from '@/app/(dashboard)/branch/[id]/financials/queries';
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

/** Keeps P&amp;L edits when switching financial tabs (separate routes) in the same session. */
const sessionPnLMemory = new Map<
  string,
  { rows: ExpenseRow[]; deductions: DeductionValues }
>();

function sessionKey(branchId: string, period: string): string {
  return `${branchId}::${period}`;
}

type MatrixStatus = 'ON TARGET' | 'CRITICAL INCREASE' | 'UNDER BUDGET';
type MatrixTone = 'emerald' | 'rose' | 'amber';

export type FinancialMatrixRow = {
  label: string;
  amount: number;
  pct: number;
  status: { label: MatrixStatus; tone: MatrixTone };
};

function percentage(value: number, total: number): number {
  if (total <= 0) return 0;
  return (value / total) * 100;
}

function badgeMeta(
  actualPct: number,
  targetPct: number,
): { label: MatrixStatus; tone: MatrixTone } {
  if (actualPct > targetPct * 1.1) return { label: 'CRITICAL INCREASE', tone: 'rose' };
  if (actualPct < targetPct * 0.85) return { label: 'UNDER BUDGET', tone: 'amber' };
  return { label: 'ON TARGET', tone: 'emerald' };
}

type KpiTone = 'good' | 'warning' | 'danger';

export type ExecutiveKpiCard = {
  label: string;
  value: number;
  target: number;
  description: string;
  tone: KpiTone;
};

type FinancialsDashboardContextValue = FinancialsDashboardData & {
  rows: ExpenseRow[];
  setRows: React.Dispatch<React.SetStateAction<ExpenseRow[]>>;
  deductions: DeductionValues;
  setDeductions: React.Dispatch<React.SetStateAction<DeductionValues>>;
  grossSales: number;
  totalDeductions: number;
  netTotal: number;
  operatingExpenses: number;
  pnl: number;
  cogs: number;
  labor: number;
  operations: number;
  matrixRows: FinancialMatrixRow[];
  kpis: ExecutiveKpiCard[];
  /** Server snapshot for the selected month (unchanged when editing P&L locally). */
  pnlBaseline: {
    netSales: number;
    cogs: number;
    operationsCost: number;
    ebitda: number;
  };
};

const FinancialsDashboardContext = createContext<FinancialsDashboardContextValue | null>(
  null,
);

export function FinancialsDashboardProvider({
  initialData,
  children,
}: {
  initialData: FinancialsDashboardData;
  children: ReactNode;
}) {
  const key = sessionKey(initialData.branchId, initialData.selectedPeriod);
  const [rows, setRows] = useState<ExpenseRow[]>(() => {
    return sessionPnLMemory.get(key)?.rows ?? initialData.initialRows;
  });
  const [deductions, setDeductions] = useState<DeductionValues>(() => {
    return sessionPnLMemory.get(key)?.deductions ?? initialData.initialDeductions;
  });

  const grossSales = initialData.grossSales;

  useEffect(() => {
    sessionPnLMemory.set(key, { rows, deductions });
  }, [key, rows, deductions]);

  const value = useMemo(() => {
    const totalDeductions =
      deductions['Square Fees'] +
      deductions.TX +
      deductions['Delivery Fee'] +
      deductions.Marketing;
    const totalExpenses = rows.reduce((sum, row) => sum + row.amount, 0);
    const netTotal = grossSales - totalDeductions;
    const cogs = rows
      .filter((row) =>
        ['US Foods', 'Lenard Paper', 'PFG', "Keany's", 'Bread', 'Warehouse'].includes(row.category),
      )
      .reduce((sum, row) => sum + row.amount, 0);
    const labor = rows.find((row) => row.category === 'Labor')?.amount ?? initialData.laborCost;
    const operations = Math.max(0, totalExpenses - cogs - labor);
    const pnl = netTotal - cogs - labor - operations;

    const matrixRows: FinancialMatrixRow[] = [
      {
        label: 'GROSS SALES',
        amount: grossSales,
        pct: 100,
        status: { label: 'ON TARGET', tone: 'emerald' },
      },
      {
        label: 'NET SALES',
        amount: netTotal,
        pct: percentage(netTotal, grossSales),
        status:
          netTotal >= grossSales * 0.92
            ? { label: 'ON TARGET', tone: 'emerald' }
            : { label: 'CRITICAL INCREASE', tone: 'rose' },
      },
      {
        label: 'COGS (INVENTORY / VENDORS)',
        amount: cogs,
        pct: percentage(cogs, grossSales),
        status: badgeMeta(percentage(cogs, grossSales), 30),
      },
      {
        label: 'GROSS PROFIT',
        amount: netTotal - cogs,
        pct: percentage(netTotal - cogs, grossSales),
        status:
          netTotal - cogs >= grossSales * 0.45
            ? { label: 'ON TARGET', tone: 'emerald' }
            : { label: 'CRITICAL INCREASE', tone: 'rose' },
      },
      {
        label: 'STAFFING',
        amount: labor,
        pct: percentage(labor, grossSales),
        status: badgeMeta(percentage(labor, grossSales), 25),
      },
      {
        label: 'OPERATIONS',
        amount: operations,
        pct: percentage(operations, grossSales),
        status: badgeMeta(percentage(operations, grossSales), 20),
      },
      {
        label: 'EBITDA',
        amount: pnl,
        pct: percentage(pnl, grossSales),
        status:
          pnl >= grossSales * 0.15
            ? { label: 'ON TARGET', tone: 'emerald' }
            : pnl >= grossSales * 0.1
              ? { label: 'UNDER BUDGET', tone: 'amber' }
              : { label: 'CRITICAL INCREASE', tone: 'rose' },
      },
    ];

    const kpis: ExecutiveKpiCard[] = [
      {
        label: 'Net Margin',
        value: percentage(pnl, grossSales),
        target: 18,
        description: 'Net profit as a share of gross sales.',
        tone:
          percentage(pnl, grossSales) >= 18
            ? 'good'
            : percentage(pnl, grossSales) >= 12
              ? 'warning'
              : 'danger',
      },
      {
        label: 'Food Cost %',
        value: percentage(cogs, grossSales),
        target: 30,
        description: 'Vendors and warehouse spend as a share of gross sales.',
        tone:
          percentage(cogs, grossSales) <= 30
            ? 'good'
            : percentage(cogs, grossSales) <= 35
              ? 'warning'
              : 'danger',
      },
      {
        label: 'Labor Cost %',
        value: percentage(labor, grossSales),
        target: 25,
        description: 'Payroll load sourced from monthly compensation.',
        tone:
          percentage(labor, grossSales) <= 25
            ? 'good'
            : percentage(labor, grossSales) <= 30
              ? 'warning'
              : 'danger',
      },
    ];

    const pnlBaseline = {
      netSales: initialData.netSales,
      cogs: initialData.cogs,
      operationsCost: initialData.operationsCost,
      ebitda: initialData.ebitda,
    };

    return {
      ...initialData,
      rows,
      setRows,
      deductions,
      setDeductions,
      grossSales,
      totalDeductions,
      netTotal,
      operatingExpenses: totalExpenses,
      pnl,
      cogs,
      labor,
      operations,
      matrixRows,
      kpis,
      pnlBaseline,
    };
  }, [initialData, rows, deductions, grossSales]);

  return (
    <FinancialsDashboardContext.Provider value={value}>
      {children}
    </FinancialsDashboardContext.Provider>
  );
}

export function useFinancialsDashboard(): FinancialsDashboardContextValue {
  const ctx = useContext(FinancialsDashboardContext);
  if (!ctx) {
    throw new Error('useFinancialsDashboard must be used within FinancialsDashboardProvider');
  }
  return ctx;
}
