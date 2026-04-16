import Link from "next/link";
import { cookies } from "next/headers";
import { ForgotPasswordSubmitButton } from "./submit-button";
import { demoRecoveryLinkAction, forgotPasswordAction } from "./actions";

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: Promise<{ sent?: string; demo_ready?: string; codename?: string; error?: string }>;
}) {
  const params = await searchParams;
  const cookieStore = await cookies();
  const demoRecoveryLink = cookieStore.get("naya_demo_recovery_link")?.value ?? "";
  const isSent = params?.sent === "1";
  const isDemoReady = params?.demo_ready === "1";
  const codename = (params?.codename ?? "").replace(/[^A-Z0-9-]/g, "");

  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_65px_-35px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Naya Recovery Studio</p>
        <h1 className="mt-2 text-3xl font-black text-[#052e36]">Forgot Password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Enter your work email and we will send a secure recovery link.
        </p>

        {params?.error ? (
          <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
            {params.error}
          </div>
        ) : null}

        {isSent ? (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-sm font-bold text-emerald-700">Recovery link sent successfully.</p>
            <p className="mt-1 text-xs text-emerald-700/90">
              Security note: we never return your existing password. Use the link in your email to set a new one.
            </p>
            {codename ? (
              <p className="mt-3 inline-flex rounded-xl border border-emerald-200 bg-white px-3 py-1.5 text-xs font-black tracking-[0.16em] text-emerald-700">
                Recovery Codename: {codename}
              </p>
            ) : null}
          </div>
        ) : null}

        <form action={forgotPasswordAction} className="mt-6 space-y-4">
          <div className="space-y-1.5">
            <label htmlFor="email" className="text-sm font-semibold text-slate-700">
              Work Email
            </label>
            <input
              id="email"
              type="email"
              name="email"
              placeholder="name@company.com"
              className="h-12 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e36]"
              required
            />
          </div>
          <ForgotPasswordSubmitButton />
        </form>

        <div className="mt-6 rounded-2xl border border-[#052e36]/15 bg-[#052e36]/5 p-4">
          <p className="text-sm font-bold text-[#052e36]">Demo Mode Recovery (No Email Needed)</p>
          <p className="mt-1 text-xs text-slate-600">
            If your demo email is not real, generate a direct recovery link and open it immediately.
          </p>

          <form action={demoRecoveryLinkAction} className="mt-3 space-y-3">
            <input
              type="email"
              name="email"
              placeholder="demo@company.com"
              className="h-11 w-full rounded-xl border border-slate-200 bg-white px-4 text-sm transition focus:outline-none focus:ring-2 focus:ring-[#052e36]"
              required
            />
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-xl border border-[#052e36] px-4 text-sm font-bold text-[#052e36] transition hover:bg-[#052e36] hover:text-white"
            >
              Generate Demo Recovery Link
            </button>
          </form>
        </div>

        {isDemoReady && demoRecoveryLink ? (
          <div className="mt-4 rounded-2xl border border-sky-200 bg-sky-50 p-4">
            <p className="text-sm font-bold text-sky-700">Demo recovery link generated.</p>
            {codename ? (
              <p className="mt-1 text-xs font-black tracking-[0.15em] text-sky-700">Code: {codename}</p>
            ) : null}
            <a
              href={demoRecoveryLink}
              className="mt-3 inline-flex rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white hover:bg-sky-700"
            >
              Open Recovery Link
            </a>
          </div>
        ) : null}

        <Link href="/login" className="mt-5 inline-flex text-sm font-semibold text-[#a48443] hover:text-[#8b6f39]">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
