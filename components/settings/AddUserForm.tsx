"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { inviteUserAction, type TeamInviteState } from "@/app/(dashboard)/settings/team/actions";
import { Loader2, UserPlus2 } from "lucide-react";

export type BranchOption = { id: string; name: string; type: string | null };

const initialState: TeamInviteState = { status: "idle" };

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-xs font-semibold text-muted-foreground tracking-wide"
    >
      {children}
    </label>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" className="w-full sm:w-auto" disabled={pending} size="lg">
      {pending ? (
        <>
          <Loader2 className="size-4 animate-spin" data-icon="inline-start" />
          Creating…
        </>
      ) : (
        <>
          <UserPlus2 className="size-4" data-icon="inline-start" />
          Add team member
        </>
      )}
    </Button>
  );
}

const inputClassName = cn(
  "flex h-10 w-full min-w-0 rounded-lg border border-border bg-background px-3 py-1 text-sm shadow-xs outline-none transition-[color,box-shadow]",
  "focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
  "disabled:pointer-events-none disabled:opacity-50"
);

export function AddUserForm({ branches }: { branches: BranchOption[] }) {
  const formId = useId();
  const formRef = useRef<HTMLFormElement>(null);
  const [state, formAction] = useActionState(inviteUserAction, initialState);
  // Controlled values + hidden inputs: some RSC/Server Action + <select> combos omit
  // "branch_id"/"role" from FormData; hidden fields are always included on submit.
  const [role, setRole] = useState("");
  const [branchId, setBranchId] = useState("");

  useEffect(() => {
    if (state.status === "success") {
      formRef.current?.reset();
      setRole("");
      setBranchId("");
    }
  }, [state.status]);

  return (
    <Card className="border-foreground/10 shadow-sm max-w-2xl">
      <CardHeader>
        <CardTitle className="text-lg font-heading">Add team member</CardTitle>
        <CardDescription>
          Creates an account with role and branch stored in their profile and sign-in session.
        </CardDescription>
        <p className="text-sm text-muted-foreground max-w-xl leading-relaxed -mt-2">
          <span className="font-medium text-foreground/90">Commissary (ships to restaurants):</span> choose{" "}
          <span className="font-medium">warehouse manager</span> for day-to-day inventory and dispatch, or{" "}
          <span className="font-medium">branch manager</span> for the same plus dashboard, staff, and payroll.{" "}
          <span className="font-medium">Branch staff</span> can use warehouse and financials but cannot dispatch.{" "}
          <span className="block mt-2">
            <span className="font-medium text-foreground/90">Restaurant locations:</span> branch manager for leadership;
            branch staff for daily warehouse and local financials.
          </span>
        </p>
      </CardHeader>
      <CardContent className="space-y-6">
        {state.status === "error" && (
          <div
            role="alert"
            className="rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive"
          >
            {state.message}
          </div>
        )}

        {state.status === "success" && (
          <div
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"
          >
            {state.message}
          </div>
        )}

        <form
          id={formId}
          ref={formRef}
          action={formAction}
          className="space-y-5"
        >
          <input type="hidden" name="role" value={role} />
          <input type="hidden" name="branch_id" value={branchId} />
          <div className="space-y-2">
            <FieldLabel htmlFor={`${formId}-full_name`}>Full name</FieldLabel>
            <input
              id={`${formId}-full_name`}
              className={inputClassName}
              name="full_name"
              type="text"
              autoComplete="name"
              required
              minLength={1}
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor={`${formId}-email`}>Email</FieldLabel>
            <input
              id={`${formId}-email`}
              className={inputClassName}
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </div>

          <div className="space-y-2">
            <FieldLabel htmlFor={`${formId}-password`}>Temporary password</FieldLabel>
            <input
              id={`${formId}-password`}
              className={inputClassName}
              name="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
            />
            <p className="text-xs text-muted-foreground">Minimum 8 characters. Users can change it after sign-in.</p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <FieldLabel htmlFor={`${formId}-role`}>Role</FieldLabel>
              <select
                id={`${formId}-role`}
                required
                className={cn(inputClassName, "cursor-pointer")}
                value={role}
                onChange={(e) => setRole(e.target.value)}
              >
                <option value="" disabled>
                  Select role
                </option>
                <option value="branch_manager">Branch manager</option>
                <option value="branch_staff">Branch staff</option>
                <option value="warehouse_manager">Warehouse manager</option>
              </select>
            </div>
            <div className="space-y-2">
              <FieldLabel htmlFor={`${formId}-branch`}>Branch</FieldLabel>
              <select
                id={`${formId}-branch`}
                required
                className={cn(inputClassName, "cursor-pointer")}
                value={branchId}
                onChange={(e) => setBranchId(e.target.value)}
              >
                <option value="" disabled>
                  Select branch
                </option>
                {branches.map((b) => {
                  const id = String(b.id);
                  return (
                    <option key={id} value={id}>
                      {b.name}
                      {b.type === "commissary" ? " (commissary)" : ""}
                    </option>
                  );
                })}
              </select>
            </div>
          </div>

          <div className="pt-1">
            <SubmitButton />
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
