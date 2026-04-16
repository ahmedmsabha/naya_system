import Link from "next/link";
import { UpdatePasswordForm } from "./update-password-form";

export default function UpdatePasswordPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gradient-to-b from-slate-50 to-white p-6">
      <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-8 shadow-[0_24px_65px_-35px_rgba(15,23,42,0.45)]">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">Naya Recovery Studio</p>
        <h1 className="mt-2 text-3xl font-black text-[#052e36]">Set New Password</h1>
        <p className="mt-2 text-sm text-slate-600">
          Choose a new password to finish account recovery.
        </p>

        <UpdatePasswordForm />

        <Link href="/login" className="mt-5 inline-flex text-sm font-semibold text-[#a48443] hover:text-[#8b6f39]">
          Back to Sign In
        </Link>
      </div>
    </div>
  );
}
