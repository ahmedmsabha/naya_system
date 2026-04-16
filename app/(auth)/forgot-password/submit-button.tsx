"use client";

import { Loader2 } from "lucide-react";
import { useFormStatus } from "react-dom";

export function ForgotPasswordSubmitButton() {
  const { pending } = useFormStatus();

  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full h-12 rounded-xl bg-[#052e36] px-4 text-sm font-bold text-white shadow-md transition hover:bg-[#08434f] focus:ring-2 focus:ring-[#052e36] focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
    >
      {pending ? (
        <span className="inline-flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          Sending Recovery Link...
        </span>
      ) : (
        "Send Recovery Link"
      )}
    </button>
  );
}
