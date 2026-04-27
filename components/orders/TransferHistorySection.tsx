import { createClient } from "@/lib/supabase/server";
import { formatDateTimeEn } from "@/lib/format/en";

function statusLabel(status: string): string {
  switch (status) {
    case "pending":
      return "Requested";
    case "in_transit":
      return "Dispatched";
    case "received":
      return "Received";
    case "disputed":
      return "Disputed";
    default:
      return status;
  }
}

export async function TransferHistorySection({
  branchId,
  branchType,
}: {
  branchId: string;
  branchType: string;
}) {
  const supabase = await createClient();
  const incoming = branchType === "branch";

  const q = supabase
    .from("transfers")
    .select("id, status, created_at, to_branch_id, from_branch_id")
    .order("created_at", { ascending: false })
    .limit(10);

  const { data: rows, error } = incoming
    ? await q.eq("to_branch_id", branchId)
    : await q.eq("from_branch_id", branchId);

  if (error) {
    return (
      <p className="text-sm text-red-700 bg-red-50 border border-red-100 rounded-2xl px-4 py-3">
        Could not load transfer history.
      </p>
    );
  }

  const transfers = rows ?? [];
  const otherIds = new Set<string>();
  for (const t of transfers) {
    if (incoming) otherIds.add(t.from_branch_id as string);
    else otherIds.add(t.to_branch_id as string);
  }
  const oid = Array.from(otherIds);
  const { data: branches } =
    oid.length > 0
      ? await supabase.from("branches").select("id, name").in("id", oid)
      : { data: [] as { id: string; name: string }[] };
  const nameById = new Map((branches ?? []).map((b) => [b.id, b.name ?? ""]));

  return (
    <section className="mt-10 md:mt-14 border-t border-slate-200 pt-8 md:pt-10">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <h2 className="text-xl font-black text-[#052e36] tracking-tight">Transfer history</h2>
        <p className="text-xs text-slate-500">
          Last 10 transfers {incoming ? "to this branch" : "from this commissary"}.
        </p>
      </div>

      {transfers.length === 0 ? (
        <p className="text-sm text-slate-500 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 px-4 py-8 text-center">
          No transfers yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-slate-100 bg-white shadow-sm">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="bg-slate-50 text-left text-[10px] uppercase tracking-wider text-slate-500">
                <th className="py-3 px-3">When</th>
                <th className="py-3 px-3">Status</th>
                <th className="py-3 px-3">{incoming ? "From" : "To"}</th>
                <th className="py-3 px-3 font-mono text-xs">Transfer</th>
              </tr>
            </thead>
            <tbody>
              {transfers.map((t) => {
                const otherId = incoming ? (t.from_branch_id as string) : (t.to_branch_id as string);
                const otherName = nameById.get(otherId) ?? "—";
                return (
                  <tr key={t.id} className="border-t border-slate-100">
                    <td className="py-2.5 px-3 text-slate-700 whitespace-nowrap">
                      {formatDateTimeEn(t.created_at ?? "", { dateStyle: "short", timeStyle: "short" })}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="inline-flex rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-bold text-[#052e36]">
                        {statusLabel(String(t.status ?? ""))}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-slate-800 max-w-[12rem] truncate" title={otherName}>
                      {otherName}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-500" title={t.id ?? undefined}>
                      {String(t.id).slice(0, 8)}…
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
