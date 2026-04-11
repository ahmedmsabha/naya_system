const EN_LOCALE = "en-US";

export function formatNumberEn(value: number, options?: Intl.NumberFormatOptions): string {
  return Number(value || 0).toLocaleString(EN_LOCALE, options);
}

export function formatDateEn(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleDateString(EN_LOCALE, options);
}

export function formatDateTimeEn(value: Date | string, options?: Intl.DateTimeFormatOptions): string {
  const d = typeof value === "string" ? new Date(value) : value;
  return d.toLocaleString(EN_LOCALE, options);
}
