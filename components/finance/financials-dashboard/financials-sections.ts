import {
  BarChart3,
  Calculator,
  CircleDollarSign,
  Gift,
  Receipt,
  type LucideIcon,
} from 'lucide-react';

export const FINANCIALS_SECTION_IDS = [
  'performance',
  'revenue',
  'accounting',
  'simulator',
  'investor',
] as const;

export type FinancialsSectionId = (typeof FINANCIALS_SECTION_IDS)[number];

export const FINANCIALS_SECTIONS: Array<{
  id: FinancialsSectionId;
  label: string;
  icon: LucideIcon;
}> = [
  { id: 'performance', label: 'Financial Performance', icon: BarChart3 },
  { id: 'revenue', label: 'Revenue Unit', icon: CircleDollarSign },
  { id: 'accounting', label: 'Accounting Center', icon: Receipt },
  { id: 'simulator', label: 'Decision Simulator', icon: Calculator },
  { id: 'investor', label: 'Investor Portal', icon: Gift },
];

export function branchFinancialsSectionHref(
  branchId: string,
  section: FinancialsSectionId,
  period: string,
): string {
  return `/branch/${branchId}/financials/${section}?period=${encodeURIComponent(period)}`;
}
