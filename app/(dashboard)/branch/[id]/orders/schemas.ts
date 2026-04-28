import { z } from "zod";

/** Matches PostgreSQL `uuid` text form (avoids Zod version/variant quirks on some IDs). */
const PG_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isPgUuidString(s: string): boolean {
  return PG_UUID_RE.test(s);
}

const uuidStr = (field: string) =>
  z.string().trim().refine(isPgUuidString, { message: `Invalid ${field}` });

const lineSchema = z.object({
  ingredient_id: uuidStr("ingredient id"),
  quantity: z.coerce.number().min(0).finite(),
});

export const createSupplyOrderSchema = z.object({
  to_branch_id: uuidStr("branch id"),
  /** JSON stringified array of lines from the client */
  lines_json: z.string().trim().min(1, "Missing line items"),
});

export type SupplyOrderLine = z.infer<typeof lineSchema>;

export function parseSupplyOrderLines(json: string): SupplyOrderLine[] {
  const raw = JSON.parse(json) as unknown;
  return z.array(lineSchema).parse(raw);
}
