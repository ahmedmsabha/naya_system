export function toMoney(value: unknown, digits = 2): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
}

export function formatCurrency(
  value: number,
  options?: {
    locale?: string;
    currency?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  },
): string {
  const {
    locale = "en-US",
    currency = "USD",
    minimumFractionDigits = 2,
    maximumFractionDigits = 2,
  } = options ?? {};

  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency,
    minimumFractionDigits,
    maximumFractionDigits,
  }).format(Number.isFinite(value) ? value : 0);
}
