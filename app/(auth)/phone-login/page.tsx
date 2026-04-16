import Link from "next/link";
import { sendPhoneOtpAction, verifyPhoneOtpAction } from "./actions";
import { PhoneAuthSubmitButton } from "./submit-button";

export default async function PhoneLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; phone?: string; error?: string }>;
}) {
  const params = await searchParams;
  const phone = (params?.phone ?? "").trim();
  const isSent = params?.sent === "1";

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_65px_-35px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Naya Mobile Access</p>
        <h1 className="mt-2 text-3xl font-black text-[#052e36]">Phone Verification Login</h1>
        <p className="mt-2 text-sm text-slate-600">
          Sign in with a one-time mobile code. Format must be international, like +15551234567.
        </p>

        {params?.error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {params.error}
          </div>
        ) : null}

        {isSent ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-semibold text-emerald-700">
            Verification code sent to {phone || "your phone"}.
          </div>
        ) : null}

        <form action={sendPhoneOtpAction} className="mt-6 space-y-3">
          <label htmlFor="phone" className="text-sm font-semibold text-slate-700">
            Phone Number
          </label>
          <input
            id="phone"
            type="tel"
            name="phone"
            defaultValue={phone}
            placeholder="+15551234567"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e36]"
            required
          />
          <PhoneAuthSubmitButton idleLabel="Send Verification Code" loadingLabel="Sending Code..." />
        </form>

        <form action={verifyPhoneOtpAction} className="mt-5 space-y-3">
          <input type="hidden" name="phone" value={phone} />
          <label htmlFor="token" className="text-sm font-semibold text-slate-700">
            Verification Code
          </label>
          <input
            id="token"
            name="token"
            inputMode="numeric"
            pattern="\d{6}"
            placeholder="123456"
            className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm tracking-[0.3em] transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e36]"
            required
          />
          <PhoneAuthSubmitButton idleLabel="Verify & Sign In" loadingLabel="Verifying..." />
        </form>

        <div className="mt-6 flex items-center gap-4 text-sm">
          <Link href="/login" className="font-semibold text-[#a48443] hover:text-[#8b6f39]">
            Back to Email Login
          </Link>
          <Link href="/forgot-password" className="font-semibold text-slate-600 hover:text-slate-800">
            Forgot Password
          </Link>
        </div>
      </div>
    </div>
  );
}
