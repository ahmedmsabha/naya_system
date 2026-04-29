"use server";

import { revalidatePath } from "next/cache";
import { getCurrentActor } from "@/lib/auth/actor";
import { createAdminClient } from "@/lib/supabase/admin";

const INVITABLE_ROLES: readonly string[] = [
  "branch_manager",
  "branch_staff",
  "warehouse_manager",
];

export type TeamInviteState =
  | { status: "idle" }
  | { status: "success"; message: string }
  | { status: "error"; message: string };

// Accept any canonical UUID string (DB / Supabase may emit v1–v5; avoid over‑strict
// RFC 4122 nibble rules that can reject valid `branches.id` values).
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function asUuid(value: string | null): string | null {
  if (value == null) return null;
  const t = value.trim();
  if (!t || !UUID_RE.test(t)) return null;
  return t;
}

function getFormString(formData: FormData, key: string): string {
  const direct = formData.get(key);
  if (typeof direct === "string" && direct.trim() !== "") {
    return direct.trim();
  }
  for (const entry of formData.getAll(key)) {
    if (typeof entry === "string" && entry.trim() !== "") {
      return entry.trim();
    }
  }
  return "";
}

/** Maps Supabase errors to actionable UI copy (Auth Admin requires the project's secret/service_role key). */
function mapAuthErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === "object" && "message" in error) {
    const msg = String((error as { message?: string }).message ?? "");
    const m = msg.toLowerCase();
    if (m.includes("invalid api key")) {
      return invalidApiKeyHint();
    }
    if (m.includes("already been registered") || m.includes("already exists") || m.includes("already registered")) {
      return "A user with this email already exists.";
    }
    if (m.includes("password")) {
      return "Password does not meet requirements.";
    }
    if (msg) return msg;
  }
  if (error instanceof Error && error.message) {
    const em = error.message.toLowerCase();
    if (em.includes("invalid api key")) {
      return invalidApiKeyHint();
    }
    return error.message;
  }
  return fallback;
}

function invalidApiKeyHint(): string {
  return (
    "Supabase rejected the server secret key (often mis-set anon/publishable key or wrong project). " +
    "Set SUPABASE_SERVICE_ROLE_KEY or SUPABASE_SECRET_KEY to this project's secret/service_role key from the dashboard " +
    "(Project Settings → API), matching NEXT_PUBLIC_SUPABASE_URL."
  );
}

/**
 * `useActionState` passes the previous state and `FormData`.
 * Creates the auth user (with JWT metadata) and a matching `public.users` row.
 */
export async function inviteUserAction(
  _prev: TeamInviteState,
  formData: FormData
): Promise<TeamInviteState> {
  const actor = await getCurrentActor();
  if (!actor?.isSuperAdmin) {
    return { status: "error", message: "Unauthorized" };
  }

  const full_name = getFormString(formData, "full_name");
  const email = getFormString(formData, "email").toLowerCase();
  const password = String(formData.get("password") ?? "");
  const role = getFormString(formData, "role");
  const branchId = asUuid(getFormString(formData, "branch_id"));

  if (!full_name) {
    return { status: "error", message: "Full name is required." };
  }
  if (!email) {
    return { status: "error", message: "Email is required." };
  }
  if (password.length < 8) {
    return { status: "error", message: "Password must be at least 8 characters." };
  }
  if (!INVITABLE_ROLES.includes(role)) {
    return { status: "error", message: "Invalid role selected." };
  }
  if (!branchId) {
    return { status: "error", message: "A valid branch is required." };
  }

  let admin;
  try {
    admin = createAdminClient();
  } catch (err) {
    const msg =
      err instanceof Error ? err.message : "Could not initialize Supabase admin client.";
    return { status: "error", message: msg };
  }

  const branchIdMetadata = branchId; // string in metadata for consistent JWT/RLS casting

  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      role,
      branch_id: branchIdMetadata,
    },
  });

  if (createError || !created?.user?.id) {
    return {
      status: "error",
      message: mapAuthErrorMessage(createError, "Could not create the account."),
    };
  }

  const newUserId = created.user.id;

  const { error: profileError } = await admin.from("users").insert({
    id: newUserId,
    full_name,
    role,
    branch_id: branchId,
    language: "en",
  });

  if (profileError) {
    const { error: deleteError } = await admin.auth.admin.deleteUser(newUserId);
    if (deleteError) {
      console.error("Failed to roll back auth user after profile error:", deleteError);
    }
    if (profileError.code === "23505") {
      return { status: "error", message: "This user profile could not be created (duplicate or conflict)." };
    }
    const pm = (profileError.message || "").toLowerCase();
    if (pm.includes("invalid api key")) {
      return { status: "error", message: invalidApiKeyHint() };
    }
    return { status: "error", message: profileError.message || "Could not create the user profile." };
  }

  revalidatePath("/settings/team");
  return { status: "success", message: "User created and can sign in." };
}
