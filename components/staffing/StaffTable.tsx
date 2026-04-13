"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStaff, toggleStaffAdpStatus, upsertStaffingSnapshot } from "@/app/(dashboard)/branch/[id]/staffing/actions";
import { StarRating } from "@/components/staffing/StarRating";
import { BadgeCheck, Loader2, Pencil, Trash2 } from "lucide-react";
import { formatNumberEn } from "@/lib/format/en";

export type EmployeeStatic = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  employee_code: string | null;
  adp_status: string;
};

export type StaffingRecord = {
  role: string;
  salaryP1: number;
  salaryP2: number;
  performanceRating: number;
  shift: string;
  hoursPerWeek: number;
  status: "active" | "on-leave" | "terminated";
  notes: string;
};

function fallbackRecord(): StaffingRecord {
  return {
    role: "crew",
    salaryP1: 0,
    salaryP2: 0,
    performanceRating: 0,
    shift: "full",
    hoursPerWeek: 40,
    status: "active",
    notes: "",
  };
}

export function StaffTable({
  branchId,
  employees,
  selectedPeriod,
  isHistorical,
  selectedSnapshot,
}: {
  branchId: string;
  employees: EmployeeStatic[];
  selectedPeriod: string;
  isHistorical: boolean;
  selectedSnapshot: Record<string, StaffingRecord>;
}) {
  const getActionError = (result: unknown): string | null => {
    if (
      result &&
      typeof result === "object" &&
      "error" in result &&
      typeof (result as { error?: unknown }).error === "string"
    ) {
      return (result as { error: string }).error;
    }
    return null;
  };

  const router = useRouter();
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [isPeriodPending, startPeriodTransition] = useTransition();
  const [editId, setEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();
  const [togglingAdpId, setTogglingAdpId] = useState<string | null>(null);
  const [quickSavingKey, setQuickSavingKey] = useState<string | null>(null);
  const [salaryEditorFor, setSalaryEditorFor] = useState<string | null>(null);
  const [salaryDraftById, setSalaryDraftById] = useState<Record<string, { p1: string; p2: string }>>({});
  const [allowHistorical, setAllowHistorical] = useState(false);

  const staffById = useMemo(() => {
    const m = new Map<string, EmployeeStatic>();
    employees.forEach((r) => m.set(r.id, r));
    return m;
  }, [employees]);

  const editingEmployee = editId ? staffById.get(editId) ?? null : null;
  const editingRecord = editId ? selectedSnapshot[editId] ?? fallbackRecord() : null;

  const filtered = employees.filter((r) => {
    const hay = `${r.full_name} ${r.email ?? ""} ${r.phone ?? ""} ${r.employee_code ?? ""}`.toLowerCase();
    return hay.includes(q.toLowerCase());
  });

  const onDelete = (id: string, name: string) => {
    const ok = window.confirm(`Delete "${name}"?`);
    if (!ok) return;
    setPendingId(id);
    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("staff_id", id);
    startTransition(async () => {
      const res = await deleteStaff(fd);
      const error = getActionError(res);
      if (error) alert(error);
      setPendingId(null);
      router.refresh();
    });
  };

  const onToggleAdp = (staffId: string) => {
    setTogglingAdpId(staffId);
    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("staff_id", staffId);
    startTransition(async () => {
      const res = await toggleStaffAdpStatus(fd);
      const error = getActionError(res);
      if (error) alert(error);
      setTogglingAdpId(null);
      router.refresh();
    });
  };

  const saveSnapshotQuick = (staffId: string, patch: Partial<StaffingRecord>, saveKey: string) => {
    if (isHistorical) {
      const ok = window.confirm(`You are editing historical period ${selectedPeriod}. Continue?`);
      if (!ok) return;
    }

    const base = selectedSnapshot[staffId] ?? fallbackRecord();
    const next: StaffingRecord = { ...base, ...patch };

    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("staff_id", staffId);
    fd.set("selected_period", selectedPeriod);
    if (isHistorical) fd.set("allow_historical", "1");
    fd.set("role", next.role);
    fd.set("salary_p1", String(next.salaryP1));
    fd.set("salary_p2", String(next.salaryP2));
    fd.set("performance_rating", String(next.performanceRating));
    fd.set("shift", next.shift);
    fd.set("hours_per_week", String(next.hoursPerWeek));
    fd.set("status", next.status);
    fd.set("notes", next.notes);

    setQuickSavingKey(saveKey);
    startTransition(async () => {
      const res = await upsertStaffingSnapshot(fd);
      const error = getActionError(res);
      if (error) alert(error);
      setQuickSavingKey(null);
      router.refresh();
    });
  };

  const closeEdit = () => {
    setEditId(null);
    setEditError(null);
    setAllowHistorical(false);
  };

  const onSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingEmployee) return;
    if (isHistorical && !allowHistorical) {
      const ok = window.confirm(
        `You are editing historical period ${selectedPeriod}. Continue?`
      );
      if (!ok) return;
      setAllowHistorical(true);
    }
    const fd = new FormData(e.currentTarget);
    fd.set("branch_id", branchId);
    fd.set("staff_id", editingEmployee.id);
    fd.set("selected_period", selectedPeriod);
    if (isHistorical) fd.set("allow_historical", "1");
    startSaveTransition(async () => {
      setEditError(null);
      const res = await upsertStaffingSnapshot(fd);
      const error = getActionError(res);
      if (error) return setEditError(error);
      router.refresh();
      closeEdit();
    });
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden" dir="ltr">
      <div className="p-5 border-b border-gray-50 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Period</label>
          <input
            type="month"
            value={selectedPeriod}
            disabled={isPeriodPending}
            onChange={(e) => {
              const next = e.target.value;
              if (!next) return;
              startPeriodTransition(() => {
                router.push(`/branch/${branchId}/staffing?period=${next}`);
              });
            }}
            className="rounded-2xl border border-gray-100 bg-gray-50/40 px-4 py-3 text-sm font-bold text-[#052e36]"
          />
          {isPeriodPending ? <Loader2 className="w-4 h-4 animate-spin text-[#2563eb]" /> : null}
        </div>
        <div className="relative flex-1 min-w-[260px]">
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search staff..."
            className="w-full rounded-2xl border border-gray-100 bg-gray-50/40 px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
          />
        </div>
        <div className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
          {filtered.length} employees
        </div>
      </div>

      {isHistorical ? (
        <div className="mx-5 mt-5 rounded-2xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-[12px] font-bold text-yellow-800">
          Historical view: {selectedPeriod}. Editing requires confirmation.
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] font-black text-gray-400 tracking-widest uppercase">
              <th className="py-4 px-6 text-left">Employee</th>
              <th className="py-4 px-4 text-center">ADP</th>
              <th className="py-4 px-4 text-center">Contact</th>
              <th className="py-4 px-4 text-center">Performance</th>
              <th className="py-4 px-4 text-right">First Half</th>
              <th className="py-4 px-4 text-right">Second Half</th>
              <th className="py-4 px-4 text-right">Total</th>
              <th className="py-4 px-4 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const current = selectedSnapshot[r.id] ?? null;
              const effective = current ?? fallbackRecord();
              const isConnected = r.adp_status === "connected";
              const isPending = pendingId === r.id;
              const totalSalary = Number(effective.salaryP1 || 0) + Number(effective.salaryP2 || 0);
              const statusTone =
                effective.status === "active"
                  ? "bg-emerald-50 text-emerald-700"
                  : effective.status === "on-leave"
                    ? "bg-amber-50 text-amber-700"
                    : "bg-red-50 text-red-700";
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                  <td className="py-7 px-6">
                    <div className="flex items-center gap-4">
                      <div className="min-w-0">
                        <div className="font-black text-[#052e36] truncate">{r.full_name}</div>
                        <div className="text-[11px] font-bold text-gray-400 mt-1 flex items-center gap-2">
                          {r.employee_code ? `ID: ${r.employee_code}` : "—"}
                          <span className={`inline-flex rounded-lg px-2 py-0.5 text-[9px] font-black uppercase ${statusTone}`}>
                            {effective.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-7 px-4 text-center">
                    <button
                      type="button"
                      disabled={togglingAdpId === r.id}
                      onClick={() => onToggleAdp(r.id)}
                      className={`inline-flex items-center gap-2 rounded-xl px-3 py-1 text-[11px] font-black transition-colors ${
                        isConnected
                          ? "bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                          : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {togglingAdpId === r.id ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : isConnected ? (
                        <BadgeCheck className="w-4 h-4" />
                      ) : null}
                      {isConnected ? "ADP connected" : "Not connected"}
                    </button>
                  </td>
                  <td className="py-7 px-4 text-center text-[12px] font-bold text-gray-500">
                    <div className="flex flex-col gap-1">
                      <span className="truncate max-w-[220px] mx-auto">{r.email ?? "—"}</span>
                      <span className="text-gray-300 text-[11px]">{r.phone ?? "—"}</span>
                    </div>
                  </td>
                  <td className="py-7 px-4 text-center">
                    <div className="inline-flex flex-col items-center gap-1">
                      <div className="relative inline-block">
                        <StarRating rating={effective.performanceRating} size={16} />
                        <div className="absolute inset-0 grid grid-cols-10">
                          {Array.from({ length: 10 }).map((_, i) => {
                            const ratingValue = (i + 1) / 2;
                            return (
                              <button
                                key={`${r.id}-rating-${ratingValue}`}
                                type="button"
                                title={`Set rating to ${ratingValue}`}
                                onClick={() =>
                                  saveSnapshotQuick(
                                    r.id,
                                    { performanceRating: ratingValue },
                                    `${r.id}-rating`
                                  )
                                }
                                className="h-full w-full"
                              />
                            );
                          })}
                        </div>
                      </div>
                      <span className="text-[10px] font-black text-gray-400">
                        {effective.performanceRating.toFixed(1)}
                      </span>
                    </div>
                  </td>
                  <td className="py-7 px-4 text-right font-black text-[#052e36]">
                    ${formatNumberEn(effective.salaryP1)}
                  </td>
                  <td className="py-7 px-4 text-right font-black text-[#052e36]">
                    ${formatNumberEn(effective.salaryP2)}
                  </td>
                  <td className="py-7 px-4 text-right">
                    {salaryEditorFor === r.id ? (
                      <div className="inline-flex flex-col items-end gap-2 rounded-xl border border-gray-200 bg-white p-2">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={salaryDraftById[r.id]?.p1 ?? String(effective.salaryP1)}
                          onChange={(e) =>
                            setSalaryDraftById((prev) => ({
                              ...prev,
                              [r.id]: { p1: e.target.value, p2: prev[r.id]?.p2 ?? String(effective.salaryP2) },
                            }))
                          }
                          className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-xs font-bold"
                        />
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={salaryDraftById[r.id]?.p2 ?? String(effective.salaryP2)}
                          onChange={(e) =>
                            setSalaryDraftById((prev) => ({
                              ...prev,
                              [r.id]: { p1: prev[r.id]?.p1 ?? String(effective.salaryP1), p2: e.target.value },
                            }))
                          }
                          className="w-24 rounded-lg border border-gray-200 px-2 py-1 text-right text-xs font-bold"
                        />
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            className="rounded-lg bg-[#2563eb] px-2 py-1 text-[10px] font-black text-white"
                            onClick={() => {
                              const nextP1 = Math.max(0, Number(salaryDraftById[r.id]?.p1 ?? effective.salaryP1) || 0);
                              const nextP2 = Math.max(0, Number(salaryDraftById[r.id]?.p2 ?? effective.salaryP2) || 0);
                              saveSnapshotQuick(
                                r.id,
                                { salaryP1: nextP1, salaryP2: nextP2 },
                                `${r.id}-salary`
                              );
                              setSalaryEditorFor(null);
                            }}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className="rounded-lg bg-gray-100 px-2 py-1 text-[10px] font-black text-gray-500"
                            onClick={() => setSalaryEditorFor(null)}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setSalaryDraftById((prev) => ({
                            ...prev,
                            [r.id]: { p1: String(effective.salaryP1), p2: String(effective.salaryP2) },
                          }));
                          setSalaryEditorFor(r.id);
                        }}
                        className="inline-flex rounded-xl bg-[#eef5fe] text-[#2563eb] px-3 py-1.5 text-[12px] font-black hover:bg-[#dbeafe]"
                      >
                        ${formatNumberEn(totalSalary)}
                      </button>
                    )}
                  </td>

                  <td className="py-7 px-4 text-left">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={() => onDelete(r.id, r.full_name)}
                        className="w-10 h-10 rounded-2xl border border-gray-100 bg-gray-50 hover:bg-red-50 hover:border-red-100 text-gray-400 hover:text-red-500 flex items-center justify-center transition-colors disabled:opacity-50"
                        title="Delete"
                        aria-label="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditId(r.id)}
                        className="w-10 h-10 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
                        title="Edit"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                    {quickSavingKey?.startsWith(`${r.id}-`) ? (
                      <div className="mt-2 text-right text-[10px] font-black text-[#2563eb]">Saving...</div>
                    ) : null}
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan={8} className="py-14 text-center text-gray-400 font-bold">
                  No employees match your search
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editingEmployee && editingRecord ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={closeEdit} />
          <div className="absolute inset-x-0 top-16 mx-auto max-w-2xl px-4">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
              <div className="p-7 border-b border-gray-50 flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-[#052e36]">Edit snapshot</div>
                  <div className="text-[11px] font-bold text-gray-400 mt-1">
                    {editingEmployee.full_name} · {selectedPeriod}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={closeEdit}
                  className="text-gray-400 hover:text-gray-600 font-black px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>

              <form onSubmit={onSave} className="p-7 grid grid-cols-1 sm:grid-cols-2 gap-4">
                {editError ? (
                  <div className="sm:col-span-2 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-bold text-red-700">
                    {editError}
                  </div>
                ) : null}

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">First half</label>
                  <input
                    name="salary_p1"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editingRecord.salaryP1}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Second half</label>
                  <input
                    name="salary_p2"
                    type="number"
                    min="0"
                    step="0.01"
                    defaultValue={editingRecord.salaryP2}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                    Performance rating (fractional)
                  </label>
                  <input
                    name="performance_rating"
                    type="number"
                    step="0.5"
                    min="0"
                    max="5"
                    defaultValue={editingRecord.performanceRating}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </div>

                <input type="hidden" name="role" value={editingRecord.role} />
                <input type="hidden" name="shift" value={editingRecord.shift} />
                <input type="hidden" name="hours_per_week" value={String(editingRecord.hoursPerWeek)} />
                <input type="hidden" name="status" value={editingRecord.status} />
                <input type="hidden" name="notes" value={editingRecord.notes} />

                <div className="sm:col-span-2 flex items-center justify-end gap-3 mt-2">
                  <button type="button" onClick={closeEdit} className="rounded-2xl px-5 py-3 text-sm font-black text-gray-500 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-2xl px-6 py-3 text-sm font-black shadow-lg shadow-blue-200/30 disabled:opacity-60"
                  >
                    {isSaving ? "..." : `Save ${selectedPeriod}`}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

