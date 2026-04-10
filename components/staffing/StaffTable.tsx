"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteStaff, updateStaff } from "@/app/(dashboard)/branch/[id]/staffing/actions";
import { BadgeCheck, MoreVertical, Pencil, Star, Trash2, X } from "lucide-react";

export type StaffRow = {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  employee_code: string | null;
  adp_status: string;
  base_salary: number;
  salary_period: string;
  salary_p1?: number | null;
  salary_p2?: number | null;
  salary_p3?: number | null;
  salary_p4?: number | null;
  performance_rating: number;
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const a = parts[0]?.[0] ?? "N";
  const b = parts[1]?.[0] ?? "";
  return (a + b).toUpperCase();
}

export function StaffTable({ rows, branchId }: { rows: StaffRow[]; branchId: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [, startTransition] = useTransition();
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [editId, setEditId] = useState<string | null>(null);
  const [editError, setEditError] = useState<string | null>(null);
  const [isSaving, startSaveTransition] = useTransition();

  const staffById = useMemo(() => {
    const m = new Map<string, StaffRow>();
    rows.forEach((r) => m.set(r.id, r));
    return m;
  }, [rows]);

  const editing = editId ? staffById.get(editId) ?? null : null;

  const filtered = rows.filter((r) => {
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
      if (res?.error) alert(res.error);
      setPendingId(null);
      router.refresh();
    });
  };

  const closeEdit = () => {
    setEditId(null);
    setEditError(null);
  };

  const onSave = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editing) return;
    const fd = new FormData(e.currentTarget);
    fd.set("branch_id", branchId);
    fd.set("staff_id", editing.id);
    startSaveTransition(async () => {
      setEditError(null);
      const res = await updateStaff(fd);
      if (res?.error) return setEditError(res.error);
      router.refresh();
      closeEdit();
    });
  };

  return (
    <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-sm overflow-hidden" dir="ltr">
      <div className="p-5 border-b border-gray-50 flex items-center justify-between gap-4 flex-wrap">
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

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 text-[11px] font-black text-gray-400 tracking-widest uppercase">
              <th className="py-4 px-6 text-left">Employee</th>
              <th className="py-4 px-4 text-center">ADP</th>
              <th className="py-4 px-4 text-center">Contact</th>
              <th className="py-4 px-4 text-center">Performance</th>
              <th className="py-4 px-4 text-center">Salary</th>
              <th className="py-4 px-4 text-right">Action</th>
            </tr>
          </thead>

          <tbody>
            {filtered.map((r) => {
              const isConnected = r.adp_status === "connected";
              const isPending = pendingId === r.id;
              const period = (r.salary_period || "monthly").toLowerCase();
              const semiMonthly = period === "semi_monthly" || period === "semimonthly";
              const quarterly = period === "quarterly";
              const p1 = Number(r.salary_p1 ?? 0) || 0;
              const p2 = Number(r.salary_p2 ?? 0) || 0;
              const p3 = Number(r.salary_p3 ?? 0) || 0;
              const p4 = Number(r.salary_p4 ?? 0) || 0;
              const monthlyTotal = Number(r.base_salary ?? 0) || (semiMonthly ? p1 + p2 : quarterly ? p1 + p2 + p3 + p4 : 0);
              return (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50/30 transition-colors">
                  <td className="py-7 px-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-[#f4f7fe] border border-blue-100 flex items-center justify-center font-black text-[#2563eb]">
                        {initials(r.full_name)}
                      </div>
                      <div className="min-w-0">
                        <div className="font-black text-[#052e36] truncate">{r.full_name}</div>
                        <div className="text-[11px] font-bold text-gray-400 mt-1">
                          {r.employee_code ? `ID: ${r.employee_code}` : "—"}
                        </div>
                      </div>
                    </div>
                  </td>

                  <td className="py-7 px-4 text-center">
                    <div className="inline-flex items-center gap-2 text-[11px] font-black">
                      {isConnected ? (
                        <>
                          <BadgeCheck className="w-4 h-4 text-[#10b981]" />
                          <span className="text-[#10b981]">Connected</span>
                        </>
                      ) : (
                        <span className="text-gray-300">Not connected</span>
                      )}
                    </div>
                  </td>

                  <td className="py-7 px-4 text-center text-[12px] font-bold text-gray-500">
                    <div className="flex flex-col gap-1">
                      <span className="truncate max-w-[220px] mx-auto">{r.email ?? "—"}</span>
                      <span className="text-gray-300 text-[11px]">{r.phone ?? ""}</span>
                    </div>
                  </td>

                  <td className="py-7 px-4 text-center">
                    <div className="inline-flex items-center gap-2">
                      <Star className="w-4 h-4 text-[#f59e0b]" />
                      <span className="font-black text-[#052e36]">{Number(r.performance_rating || 0).toFixed(2)}</span>
                    </div>
                  </td>

                  <td className="py-7 px-4 text-center">
                    {semiMonthly ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="font-black text-[#052e36]">${p1.toLocaleString()}</div>
                        <div className="font-black text-[#052e36]">${p2.toLocaleString()}</div>
                        <div className="mt-1 rounded-xl bg-[#052e36] text-white px-4 py-1.5 text-[11px] font-black tracking-widest">
                          TOTAL: ${Number(monthlyTotal ?? 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] font-black text-gray-300 tracking-widest uppercase mt-1">semi-monthly</div>
                      </div>
                    ) : quarterly ? (
                      <div className="flex flex-col items-center gap-1">
                        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm font-black text-[#052e36]">
                          <span>${p1.toLocaleString()}</span>
                          <span>${p2.toLocaleString()}</span>
                          <span>${p3.toLocaleString()}</span>
                          <span>${p4.toLocaleString()}</span>
                        </div>
                        <div className="mt-1 rounded-xl bg-[#052e36] text-white px-4 py-1.5 text-[11px] font-black tracking-widest">
                          TOTAL: ${Number(monthlyTotal ?? 0).toLocaleString()}
                        </div>
                        <div className="text-[10px] font-black text-gray-300 tracking-widest uppercase mt-1">quarterly</div>
                      </div>
                    ) : (
                      <>
                        <div className="font-black text-[#052e36]">${Number(r.base_salary || 0).toLocaleString()}</div>
                        <div className="text-[10px] font-black text-gray-300 tracking-widest uppercase mt-1">
                          {r.salary_period}
                        </div>
                      </>
                    )}
                  </td>

                  <td className="py-7 px-4 text-left">
                    <div className="flex items-center justify-end gap-2 relative">
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
                        onClick={() => setOpenMenuId((cur) => (cur === r.id ? null : r.id))}
                        className="w-10 h-10 rounded-2xl border border-gray-100 bg-white hover:bg-gray-50 text-gray-400 hover:text-gray-600 flex items-center justify-center transition-colors"
                        title="More"
                        aria-label="More"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === r.id ? (
                        <div className="absolute right-0 top-12 w-44 rounded-2xl border border-gray-100 bg-white shadow-xl overflow-hidden z-10">
                          <button
                            type="button"
                            onClick={() => {
                              setOpenMenuId(null);
                              setEditId(r.id);
                            }}
                            className="w-full px-4 py-3 text-left text-sm font-black text-[#052e36] hover:bg-gray-50 flex items-center gap-2"
                          >
                            <Pencil className="w-4 h-4 text-gray-400" />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => setOpenMenuId(null)}
                            className="w-full px-4 py-3 text-left text-sm font-black text-gray-400 hover:bg-gray-50 flex items-center gap-2"
                          >
                            <X className="w-4 h-4" />
                            Close
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </td>
                </tr>
              );
            })}

            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="py-14 text-center text-gray-400 font-bold">
                  No employees match your search
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {editing ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={closeEdit} />
          <div className="absolute inset-x-0 top-16 mx-auto max-w-2xl px-4">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden">
              <div className="p-7 border-b border-gray-50 flex items-center justify-between gap-4">
                <div>
                  <div className="text-lg font-black text-[#052e36]">Edit staff</div>
                  <div className="text-[11px] font-bold text-gray-400 mt-1">{editing.full_name}</div>
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

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Full name</label>
                  <input
                    name="full_name"
                    defaultValue={editing.full_name}
                    required
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Email</label>
                  <input
                    name="email"
                    type="email"
                    defaultValue={editing.email ?? ""}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Phone</label>
                  <input
                    name="phone"
                    defaultValue={editing.phone ?? ""}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Employee ID</label>
                  <input
                    name="employee_code"
                    defaultValue={editing.employee_code ?? ""}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">ADP</label>
                  <select
                    name="adp_status"
                    defaultValue={editing.adp_status ?? "not_connected"}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  >
                    <option value="connected">Connected</option>
                    <option value="not_connected">Not connected</option>
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Salary</label>
                  <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <input
                      name="salary_p1"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={String(Number(editing.salary_p1 ?? 0) || 0)}
                      placeholder="Part #1"
                      className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                    />
                    <input
                      name="salary_p2"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={String(Number(editing.salary_p2 ?? 0) || 0)}
                      placeholder="Part #2"
                      className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                    />
                    <input
                      name="salary_p3"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={String(Number(editing.salary_p3 ?? 0) || 0)}
                      placeholder="Part #3"
                      className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                    />
                    <input
                      name="salary_p4"
                      type="number"
                      step="0.01"
                      min="0"
                      defaultValue={String(Number(editing.salary_p4 ?? 0) || 0)}
                      placeholder="Part #4"
                      className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                    />
                  </div>
                  <input type="hidden" name="base_salary" value={String(Number(editing.base_salary ?? 0) || 0)} />
                  <div className="mt-2 text-[11px] font-bold text-gray-400">
                    Leave any part empty to count as 0. Semi-monthly uses Part #1 + Part #2. Quarterly uses Part #1–#4.
                  </div>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Period</label>
                  <select
                    name="salary_period"
                    defaultValue={editing.salary_period ?? "monthly"}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  >
                    <option value="hourly">Hourly</option>
                    <option value="weekly">Weekly</option>
                    <option value="biweekly">Biweekly</option>
                    <option value="semi_monthly">Semi-monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="monthly">Monthly</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Rating (0-5)</label>
                  <input
                    name="performance_rating"
                    type="number"
                    step="0.01"
                    min="0"
                    max="5"
                    defaultValue={String(editing.performance_rating ?? 0)}
                    className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                  />
                </div>

                <div className="sm:col-span-2 flex items-center justify-end gap-3 mt-2">
                  <button type="button" onClick={closeEdit} className="rounded-2xl px-5 py-3 text-sm font-black text-gray-500 hover:bg-gray-50">
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-2xl px-6 py-3 text-sm font-black shadow-lg shadow-blue-200/30 disabled:opacity-60"
                  >
                    {isSaving ? "..." : "Save changes"}
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

