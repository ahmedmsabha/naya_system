const PERIOD_REGEX = /^\d{4}-(0[1-9]|1[0-2])$/;
const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

function fromPeriod(period: string): Date {
  return new Date(`${period}-01T12:00:00`);
}

export function monthKeyFromDate(input: Date): string {
  return `${input.getFullYear()}-${String(input.getMonth() + 1).padStart(2, "0")}`;
}

export function monthKeyNow(): string {
  return monthKeyFromDate(new Date());
}

export function isPeriodKey(value: string): boolean {
  return PERIOD_REGEX.test(value);
}

export function parsePeriod(value: string | null | undefined, fallback = monthKeyNow()): string {
  const normalized = String(value ?? "").trim();
  return isPeriodKey(normalized) ? normalized : fallback;
}

export function monthStartIso(period: string): string {
  return `${period}-01`;
}

export function monthEndIso(period: string): string {
  const d = fromPeriod(period);
  d.setMonth(d.getMonth() + 1);
  d.setDate(0);
  return `${period}-${String(d.getDate()).padStart(2, "0")}`;
}

export function nextMonthStartIso(period: string): string {
  const d = fromPeriod(period);
  d.setMonth(d.getMonth() + 1);
  return monthStartIso(monthKeyFromDate(d));
}

export function addMonths(period: string, delta: number): string {
  const d = fromPeriod(period);
  d.setMonth(d.getMonth() + delta);
  return monthKeyFromDate(d);
}

export function monthLabel(period: string, locale = "en-US"): string {
  return fromPeriod(period).toLocaleDateString(locale, {
    month: "long",
    year: "numeric",
  });
}

export function shortMonthLabel(period: string, locale = "en-US"): string {
  return fromPeriod(period).toLocaleDateString(locale, { month: "short" });
}

export function isIsoDate(value: string): boolean {
  return ISO_DATE_REGEX.test(value);
}

export function periodFromDateIso(dateIso: string): string {
  return dateIso.slice(0, 7);
}
