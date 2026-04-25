"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

export async function loginAction(formData: FormData) {
  const supabase = await createClient();
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  const { data: signInData, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return redirect("/login?error=Invalid%20Credentials");
  }

  // Proxy/middleware enforces RLS with JWT user_metadata. Align session claims from
  // public.users so DB-defined role/branch_id matches what authorize() and RLS expect.
  const authed = signInData.user ?? (await supabase.auth.getUser()).data.user;
  if (authed) {
    const { data: profile } = await supabase
      .from("users")
      .select("role, branch_id")
      .eq("id", authed.id)
      .maybeSingle();

    if (profile?.role) {
      const data: { role: string; branch_id?: string } = {
        role: String(profile.role),
      };
      if (profile.branch_id) {
        data.branch_id = String(profile.branch_id);
      }
      await supabase.auth.updateUser({ data });
    }
  }

  revalidatePath("/", "layout");
  redirect("/");
}
