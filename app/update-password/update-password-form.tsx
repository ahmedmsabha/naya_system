"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export function UpdatePasswordForm() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const initRecoverySession = async () => {
      try {
        const existing = await supabase.auth.getSession();
        if (existing.data.session) {
          if (isMounted) setIsReady(true);
          return;
        }

        // Newer Supabase recovery links (PKCE) often include `?code=...`.
        const url = new URL(window.location.href);
        const code = url.searchParams.get("code");
        if (code) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
          if (exchangeError) {
            if (isMounted) {
              setError("Recovery session is missing or expired. Open a fresh recovery link and try again.");
              setIsReady(true);
            }
            return;
          }

          if (isMounted) setIsReady(true);
          return;
        }

        // Older links (and some generated links) may include tokens in the URL hash.
        const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
        const hashParams = new URLSearchParams(hash);
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        if (accessToken && refreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            if (isMounted) setError("Recovery session is missing or expired. Open a fresh recovery link and try again.");
          }
        } else {
          if (isMounted) setError("Recovery session is missing or expired. Open a fresh recovery link and try again.");
        }
      } finally {
        if (isMounted) setIsReady(true);
      }
    };

    void initRecoverySession();

    return () => {
      isMounted = false;
    };
  }, [supabase]);

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setSuccess(null);

    if (!isReady) return;

    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Password confirmation does not match.");
      return;
    }

    setIsSubmitting(true);
    const { error: updateError } = await supabase.auth.updateUser({ password });
    setIsSubmitting(false);

    if (updateError) {
      setError("Recovery session is missing or expired. Open a fresh recovery link and try again.");
      return;
    }

    setSuccess("Password updated. Redirecting to login...");
    router.replace("/login?reset=1");
    router.refresh();
  };

  return (
    <form onSubmit={onSubmit} className="mt-6 space-y-4">
      {!isReady ? (
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            Preparing secure recovery session...
          </span>
        </div>
      ) : null}
      {error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700">
          {error}
        </div>
      ) : null}
      {success ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
          {success}
        </div>
      ) : null}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700" htmlFor="password">
          New Password
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e36]"
          required
        />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700" htmlFor="confirm-password">
          Confirm Password
        </label>
        <input
          id="confirm-password"
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="h-11 w-full rounded-xl border border-slate-200 bg-slate-50 px-4 text-sm transition focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e36]"
          required
        />
      </div>
      <button
        type="submit"
        disabled={!isReady || isSubmitting}
        className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#052e36] px-4 text-sm font-bold text-white transition hover:bg-[#08434f] disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Saving Password...
          </>
        ) : (
          "Update Password"
        )}
      </button>
    </form>
  );
}
