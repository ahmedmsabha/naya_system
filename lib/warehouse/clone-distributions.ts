/** Shallow clone: ingredient_id → date → qty */
export function cloneDistributions(
  src: Record<string, Record<string, number>>
): Record<string, Record<string, number>> {
  const out: Record<string, Record<string, number>> = {};
  for (const ing of Object.keys(src)) {
    out[ing] = { ...src[ing] };
  }
  return out;
}

/** Stable fingerprint of distribution payload (for resetting client mirror when server week/data changes). */
export function distributionsFingerprint(
  d: Record<string, Record<string, number>>
): string {
  const parts: string[] = [];
  for (const ing of Object.keys(d).sort()) {
    const row = d[ing];
    for (const date of Object.keys(row).sort()) {
      parts.push(`${ing}:${date}:${row[date]}`);
    }
  }
  return parts.join("|");
}
