export function formatFinancialCurrency(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

export function formatFinancialPct(value: number): string {
  return `${value.toFixed(1)}%`;
}
