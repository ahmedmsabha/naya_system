export function toMoney(value: unknown, digits = 2): number {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Number(n.toFixed(digits));
}

export type FormatCurrencyOptions = {
  locale?: string;
  currency?: string;
  minimumFractionDigits?: number;
  maximumFractionDigits?: number;
};

/**
 * Formats USD. Negative values render in standard accounting style with a leading minus, e.g. `-$14,000.00`.
 * (Uses `Intl` `en-US` currency; not parentheses-style `($14,000.00)` unless you switch `currencySign`.)
 */
export function formatCurrency(value: number, options?: FormatCurrencyOptions): string {
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

/** Two-decimal USD for P&amp;L tables and detailed financial lines. */
export function formatAccountingCurrency(value: number, options?: Omit<FormatCurrencyOptions, "minimumFractionDigits" | "maximumFractionDigits">): string {
  return formatCurrency(value, {
    ...options,
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function isNetLoss(value: number): boolean {
  return Number.isFinite(value) && value < 0;
}

export function netProfitLossLabel(value: number): "Net Profit" | "Net Loss" {
  return isNetLoss(value) ? "Net Loss" : "Net Profit";
}

export function ebitdaRowLabel(value: number): "NET LOSS (EBITDA)" | "NET PROFIT (EBITDA)" {
  return isNetLoss(value) ? "NET LOSS (EBITDA)" : "NET PROFIT (EBITDA)";
}
