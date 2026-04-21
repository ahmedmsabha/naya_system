import { formatCurrency } from '@/lib/domain/money';

/** Whole-dollar USD for KPI cards; negatives show as -$N (en-US Intl). */
export function formatFinancialCurrency(value: number): string {
  return formatCurrency(value, { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/** Two-decimal USD for detailed financial lines. */
export function formatFinancialCurrencyDetailed(value: number): string {
  return formatCurrency(value, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatFinancialPct(value: number): string {
  return `${value.toFixed(1)}%`;
}
