export type WeekdayKey =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

/** Calendar date in local timezone — avoids `toISOString()` shifting the day across UTC boundaries. */
export function toLocalIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function localTodayIso(): string {
  return toLocalIsoDate(new Date());
}

/** Normalize `YYYY-MM-DD` for URL; invalid → today (local). */
export function parseWarehouseIsoDate(raw: string | undefined): string {
  if (!raw || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    return localTodayIso();
  }
  const d = new Date(`${raw}T12:00:00`);
  if (Number.isNaN(d.getTime())) return localTodayIso();
  return raw;
}

/** Monday–Sunday week containing `anchorIso` (interpreted in local calendar). All keys are local YYYY-MM-DD. */
export function getWeekDatesForDate(anchorIso: string): Record<WeekdayKey, string> {
  const anchor = new Date(`${anchorIso}T12:00:00`);
  const dayOfWeek = anchor.getDay();
  const monday = new Date(anchor);
  monday.setDate(anchor.getDate() - ((dayOfWeek + 6) % 7));

  const days = [
    "MONDAY",
    "TUESDAY",
    "WEDNESDAY",
    "THURSDAY",
    "FRIDAY",
    "SATURDAY",
    "SUNDAY",
  ] as const;
  const result = {} as Record<WeekdayKey, string>;
  days.forEach((dayName, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    result[dayName] = toLocalIsoDate(d);
  });
  return result;
}
