export type DateKeyedQuantities = Record<string, Record<string, number>>;

export function cloneDateKeyedQuantities(src: DateKeyedQuantities): DateKeyedQuantities {
  const out: DateKeyedQuantities = {};
  for (const [date, row] of Object.entries(src)) {
    out[date] = { ...row };
  }
  return out;
}

export function dateKeyedQuantitiesFingerprint(src: DateKeyedQuantities): string {
  const parts: string[] = [];
  for (const date of Object.keys(src).sort()) {
    const row = src[date] ?? {};
    for (const itemId of Object.keys(row).sort()) {
      parts.push(`${date}:${itemId}:${row[itemId]}`);
    }
  }
  return parts.join("|");
}
