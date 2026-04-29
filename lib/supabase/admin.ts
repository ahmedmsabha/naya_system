import "server-only";

import { createClient } from "@supabase/supabase-js";

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
}

/** Decode JWT payload segment only — used to catch anon→service_role mix-ups before calling Supabase. */
function decodeJwtPayload(jwt: string): Record<string, unknown> | null {
  if (!jwt.startsWith("eyJ")) return null;
  const parts = jwt.split(".");
  if (parts.length < 2) return null;
  try {
    const segment = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const padded = segment + "=".repeat((4 - (segment.length % 4)) % 4);
    const json = Buffer.from(padded, "base64").toString("utf8");
    return JSON.parse(json) as Record<string, unknown>;
  } catch {
    return null;
  }
}

/** Project ref from `https://<ref>.supabase.co` — undefined for custom domains / self-hosted. */
function supabaseProjectRefFromUrl(url: string): string | null {
  try {
    const host = new URL(url).hostname.toLowerCase();
    const m = host.match(/^([a-z0-9]+)\.supabase\.co$/);
    return m?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * Fail fast with clear messages when env looks wrong (same symptom as HTTP "Invalid API key").
 * New opaque secrets (`sb_secret_…`) skip JWT checks — Supabase validates those on first request.
 */
function assertPlausibleServerSecret(supabaseUrl: string, secretKey: string): void {
  if (secretKey.startsWith("sb_publishable_")) {
    throw new Error(
      "Server secret env uses a publishable key (sb_publishable_…). Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to the secret key (sb_secret_…) or legacy service_role JWT — not the browser/publishable key."
    );
  }

  const payload = decodeJwtPayload(secretKey);
  if (!payload) {
    return;
  }

  const role = payload.role;
  if (role === "anon") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is set to the anon JWT. Use the service_role secret from Project Settings → API (or sb_secret_…), not the anon/publishable key."
    );
  }

  const urlRef = supabaseProjectRefFromUrl(supabaseUrl);
  const jwtRef = typeof payload.ref === "string" ? payload.ref : null;
  if (urlRef && jwtRef && urlRef !== jwtRef) {
    throw new Error(
      `Secret key is for Supabase project "${jwtRef}" but NEXT_PUBLIC_SUPABASE_URL is for "${urlRef}". Use URL and secret from the same project; check .env.local did not override .env with an old key.`
    );
  }
}

/**
 * Service-role client for server-only admin operations (bypasses RLS).
 * Use `process.env.SUPABASE_SERVICE_ROLE_KEY` in production. Never import this from client code.
 * Also supports revocable `SUPABASE_SECRET_KEY` where the project has migrated off legacy names.
 */
export function createAdminClient() {
  const supabaseUrl = trimEnv(process.env.NEXT_PUBLIC_SUPABASE_URL);
  // Legacy service role, revocable project secret, or older env aliases.
  const secretKey =
    trimEnv(process.env.SUPABASE_SERVICE_ROLE_KEY) ??
    trimEnv(process.env.SUPABASE_SECRET_KEY) ??
    trimEnv(process.env.SUPABASE_SERVICE_ROLE);

  if (!supabaseUrl || !secretKey) {
    throw new Error("Missing Supabase admin configuration.");
  }

  assertPlausibleServerSecret(supabaseUrl, secretKey);

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
