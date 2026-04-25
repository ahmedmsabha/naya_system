import { getCurrentActor } from "@/lib/auth/actor";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { AddUserForm, type BranchOption } from "@/components/settings/AddUserForm";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users } from "lucide-react";

type TeamMemberRow = {
  id: string;
  full_name: string;
  role: string;
  branch_id: string | null;
  branches: { name: string } | { name: string }[] | null;
};

function branchLabel(row: TeamMemberRow): string {
  if (!row.branch_id) return "—";
  const b = row.branches;
  if (!b) return "—";
  if (Array.isArray(b)) {
    return b[0]?.name ?? "—";
  }
  return b.name ?? "—";
}

export default async function TeamSettingsPage() {
  const actor = await getCurrentActor();
  if (!actor) {
    redirect("/login");
  }
  if (!actor.isSuperAdmin) {
    redirect("/");
  }

  const supabase = await createClient();
  const { data: branchRows, error: branchesError } = await supabase
    .from("branches")
    .select("id, name, type")
    .order("name", { ascending: true });

  const { data: membersRaw, error: membersError } = await supabase
    .from("users")
    .select("id, full_name, role, branch_id, branches ( name )")
    .order("full_name", { ascending: true });

  const branches: BranchOption[] = (branchRows ?? []).map((b) => ({
    id: b.id,
    name: b.name,
    type: b.type,
  }));

  const members: TeamMemberRow[] = (membersRaw ?? []) as TeamMemberRow[];

  return (
    <div className="space-y-10">
      <div>
        <h1 className="text-2xl font-heading font-semibold tracking-tight text-[#052e36]">
          Team management
        </h1>
        <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
          Invite branch operators and set their sign-in access. Only super administrators can
          create accounts.
        </p>
        {branchesError && (
          <p className="mt-2 text-sm text-amber-700" role="alert">
            Branches could not be loaded. Try refreshing. ({branchesError.message})
          </p>
        )}
        {membersError && (
          <p className="mt-2 text-sm text-amber-700" role="alert">
            Team list could not be loaded. ({membersError.message})
          </p>
        )}
      </div>

      <div className="grid gap-10 lg:grid-cols-2 items-start">
        <AddUserForm branches={branches} />

        <Card className="border-foreground/10 shadow-sm">
          <CardHeader className="border-b border-foreground/5">
            <div className="flex items-center gap-2">
              <div className="flex size-9 items-center justify-center rounded-lg bg-[#052e36]/5">
                <Users className="size-4 text-[#052e36]" />
              </div>
              <div>
                <CardTitle className="text-lg font-heading">Team members</CardTitle>
                <CardDescription>Profiles in this workspace ({members.length})</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-4">
            {members.length === 0 ? (
              <p className="text-sm text-muted-foreground">No user profiles found yet.</p>
            ) : (
              <ul className="divide-y divide-foreground/10">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex flex-col gap-2 py-4 first:pt-0 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div>
                      <p className="font-medium text-foreground">{m.full_name}</p>
                      <p className="text-sm text-muted-foreground">{branchLabel(m)}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge
                        variant="secondary"
                        className="text-xs font-medium capitalize"
                      >
                        {m.role?.replace(/_/g, " ")}
                      </Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
