"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function PhoneAuthSubmitButton({ idleLabel, loadingLabel }: { idleLabel: string; loadingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#052e36] px-4 text-sm font-bold text-white transition hover:bg-[#08434f] disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          {loadingLabel}
        </>
      ) : (
        idleLabel
      )}
    </button>
  );
}
