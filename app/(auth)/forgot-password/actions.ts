"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

const forgotPasswordSchema = z.object({
  email: z.string().trim().email("Enter a valid work email."),
});

const recoveryWords = [
  "AURORA",
  "EMBER",
  "RIVER",
  "NEBULA",
  "ATLAS",
  "SUMMIT",
  "CINDER",
  "NOVA",
];

function createRecoveryCodename(): string {
  const left = recoveryWords[Math.floor(Math.random() * recoveryWords.length)];
  const right = recoveryWords[Math.floor(Math.random() * recoveryWords.length)];
  const digits = Math.floor(100 + Math.random() * 900);
  return `${left}-${right}-${digits}`;
}

export async function forgotPasswordAction(formData: FormData): Promise<void> {
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });

  if (!parsed.success) {
    redirect("/forgot-password?error=Enter%20a%20valid%20work%20email.");
  }

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${siteUrl}/update-password`,
  });

  const codename = createRecoveryCodename();
  redirect(`/forgot-password?sent=1&codename=${encodeURIComponent(codename)}`);
}

export async function demoRecoveryLinkAction(formData: FormData): Promise<void> {
  const parsed = forgotPasswordSchema.safeParse({
    email: String(formData.get("email") ?? ""),
  });

  if (!parsed.success) {
    redirect("/forgot-password?error=Enter%20a%20valid%20work%20email.");
  }

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

  let demoLink = "";
  try {
    const adminClient = createAdminClient();
    const { data, error } = await adminClient.auth.admin.generateLink({
      type: "recovery",
      email: parsed.data.email,
      options: {
        redirectTo: `${siteUrl}/update-password`,
      },
    });

    if (error) {
      redirect("/forgot-password?error=Unable%20to%20generate%20demo%20recovery%20link.");
    }

    const properties = (data?.properties ?? {}) as {
      action_link?: string;
      link?: string;
    };
    demoLink = properties.action_link ?? properties.link ?? "";
  } catch {
    redirect("/forgot-password?error=Demo%20recovery%20requires%20a%20service%20role%20key.");
  }

  if (!demoLink) {
    redirect("/forgot-password?error=No%20demo%20link%20was%20generated.");
  }

  const cookieStore = await cookies();
  cookieStore.set("naya_demo_recovery_link", demoLink, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/forgot-password",
    maxAge: 60 * 5,
  });

  const codename = createRecoveryCodename();
  redirect(`/forgot-password?demo_ready=1&codename=${encodeURIComponent(codename)}`);
}
