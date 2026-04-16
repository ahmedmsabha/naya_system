"use client";

import { type ReactNode, useMemo, useState, useTransition } from "react";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { createClient } from "@/lib/supabase/client";

type LogoutConfirmButtonProps = {
  triggerClassName: string;
  icon?: ReactNode;
  label?: string;
};

export function LogoutConfirmButton({
  triggerClassName,
  icon,
  label = "Log Out",
}: LogoutConfirmButtonProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const handleLogout = () => {
    setError(null);
    startTransition(async () => {
      const { error: signOutError } = await supabase.auth.signOut({ scope: "global" });
      if (signOutError) {
        setError("Unable to sign out right now. Please try again.");
        return;
      }

      setOpen(false);
      router.replace("/login?logged_out=1");
      router.refresh();
    });
  };

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button type="button" className={triggerClassName}>
          {icon}
          <span>{label}</span>
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Are you sure you want to log out?</AlertDialogTitle>
          <AlertDialogDescription>
            You will be signed out of Naya Enterprise and redirected to the sign-in page.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error ? <p className="text-xs font-semibold text-rose-600">{error}</p> : null}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
          <button
            type="button"
            onClick={handleLogout}
            disabled={isPending}
            className="inline-flex h-10 min-w-[120px] items-center justify-center rounded-xl bg-[#052e36] px-4 text-sm font-semibold text-white transition hover:bg-[#08434f] disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing Out...
              </span>
            ) : (
              "Yes, Log Out"
            )}
          </button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
