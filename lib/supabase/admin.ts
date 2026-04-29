import "server-only";

import { createClient } from "@supabase/supabase-js";

function trimEnv(value: string | undefined): string | undefined {
  const t = value?.trim();
  return t ? t : undefined;
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

  return createClient(supabaseUrl, secretKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
