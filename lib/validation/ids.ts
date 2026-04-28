import { z } from "zod";

/**
 * 8-4-4-4-12 hex id as stored by PostgreSQL and encoded in QRs. Zod 4’s built-in
 * `z.string().uuid()` follows RFC 4122 variant rules and can reject values Postgres
 * still returns as `uuid` (e.g. some non–version-4 forms). This matches the client scanner.
 */
export const zUuidLoose = z
  .string()
  .trim()
  .regex(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
    { message: "Invalid id" },
  );
