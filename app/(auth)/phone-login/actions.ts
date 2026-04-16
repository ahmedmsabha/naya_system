"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const phoneSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in international format, for example +15551234567."),
});

const verifySchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(/^\+[1-9]\d{7,14}$/, "Phone must be in international format."),
  token: z.string().trim().regex(/^\d{6}$/, "Verification code must be 6 digits."),
});

export async function sendPhoneOtpAction(formData: FormData): Promise<void> {
  const parsed = phoneSchema.safeParse({
    phone: String(formData.get("phone") ?? ""),
  });

  if (!parsed.success) {
    redirect("/phone-login?error=Use%20format%20%2B15551234567");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({
    phone: parsed.data.phone,
    options: {
      shouldCreateUser: false,
    },
  });

  if (error) {
    redirect("/phone-login?error=Unable%20to%20send%20verification%20code");
  }

  redirect(`/phone-login?sent=1&phone=${encodeURIComponent(parsed.data.phone)}`);
}

export async function verifyPhoneOtpAction(formData: FormData): Promise<void> {
  const parsed = verifySchema.safeParse({
    phone: String(formData.get("phone") ?? ""),
    token: String(formData.get("token") ?? ""),
  });

  if (!parsed.success) {
    redirect("/phone-login?error=Phone%20or%20code%20is%20invalid");
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({
    phone: parsed.data.phone,
    token: parsed.data.token,
    type: "sms",
  });

  if (error) {
    redirect(`/phone-login?sent=1&phone=${encodeURIComponent(parsed.data.phone)}&error=Invalid%20or%20expired%20code`);
  }

  revalidatePath("/", "layout");
  redirect("/");
}
