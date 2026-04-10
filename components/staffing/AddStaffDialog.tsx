"use client";

import { useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Plus, UsersRound, Wand2, Upload } from "lucide-react";
import { addStaff, bulkAddStaff } from "@/app/(dashboard)/branch/[id]/staffing/actions";

export function AddStaffDialog({ branchId }: { branchId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"smart" | "manual" | "bulk">("smart");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [manualPeriod, setManualPeriod] = useState<string>("monthly");

  const smartRef = useRef<HTMLInputElement>(null);
  const manualRef = useRef<HTMLFormElement>(null);
  const bulkRef = useRef<HTMLTextAreaElement>(null);

  const smartHint = useMemo(
    () => `Example: "Add staff: SULEMA LEMUS, sulema.l@georgetown.com, 2250"`,
    []
  );

  const close = () => {
    setOpen(false);
    setError(null);
    setManualPeriod("monthly");
  };

  const parseSmart = (text: string) => {
    // Accept: name, email, salary (comma-separated)
    const parts = text.split(",").map((p) => p.trim()).filter(Boolean);
    const full_name = parts[0] ?? "";
    const email = parts[1] ?? "";
    const base_salary = parts[2] ?? "0";
    return { full_name, email, base_salary };
  };

  const submitSmart = () => {
    const value = smartRef.current?.value ?? "";
    const parsed = parseSmart(value);
    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("full_name", parsed.full_name);
    fd.set("email", parsed.email);
    fd.set("base_salary", parsed.base_salary);
    fd.set("salary_period", "monthly");
    startTransition(async () => {
      setError(null);
      const res = await addStaff(fd);
      if (res?.error) return setError(res.error);
      if (smartRef.current) smartRef.current.value = "";
      router.refresh();
      close();
    });
  };

  const submitManual = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    fd.set("branch_id", branchId);
    startTransition(async () => {
      setError(null);
      const res = await addStaff(fd);
      if (res?.error) return setError(res.error);
      manualRef.current?.reset();
      router.refresh();
      close();
    });
  };

  const submitBulk = () => {
    const raw = bulkRef.current?.value ?? "";
    const fd = new FormData();
    fd.set("branch_id", branchId);
    fd.set("raw", raw);
    startTransition(async () => {
      setError(null);
      const res = await bulkAddStaff(fd);
      if (res?.error) return setError(res.error);
      if (bulkRef.current) bulkRef.current.value = "";
      router.refresh();
      close();
    });
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-2xl px-5 py-3 text-sm font-black shadow-lg shadow-blue-200/40 active:scale-[0.99] transition-all"
      >
        <Plus className="w-4 h-4" />
        Add staff
      </button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/30" onClick={close} />
          <div className="absolute inset-x-0 top-16 mx-auto max-w-2xl px-4">
            <div className="bg-white rounded-[2.5rem] border border-gray-100 shadow-2xl overflow-hidden" dir="ltr">
              <div className="p-7 border-b border-gray-50 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-[#eef5fe] border border-blue-100 flex items-center justify-center">
                    <UsersRound className="w-5 h-5 text-[#2563eb]" />
                  </div>
                  <div>
                    <div className="text-lg font-black text-[#052e36]">Add staff</div>
                    <div className="text-[11px] font-bold text-gray-400 mt-1">
                      Choose the fastest way to add employees
                    </div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={close}
                  className="text-gray-400 hover:text-gray-600 font-black px-3 py-2 rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Close
                </button>
              </div>

              <div className="px-7 pt-5">
                <div className="flex items-center gap-2 bg-gray-50/80 border border-gray-100 rounded-2xl p-2">
                  <button
                    type="button"
                    onClick={() => setTab("smart")}
                    className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-black tracking-widest uppercase transition-colors ${
                      tab === "smart" ? "bg-white text-[#052e36] shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 justify-center w-full">
                      <Wand2 className="w-4 h-4" /> Smart
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("manual")}
                    className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-black tracking-widest uppercase transition-colors ${
                      tab === "manual" ? "bg-white text-[#052e36] shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    Manual
                  </button>
                  <button
                    type="button"
                    onClick={() => setTab("bulk")}
                    className={`flex-1 rounded-xl px-3 py-2 text-[11px] font-black tracking-widest uppercase transition-colors ${
                      tab === "bulk" ? "bg-white text-[#052e36] shadow-sm" : "text-gray-400 hover:text-gray-600"
                    }`}
                  >
                    <span className="inline-flex items-center gap-2 justify-center w-full">
                      <Upload className="w-4 h-4" /> Bulk
                    </span>
                  </button>
                </div>
              </div>

              <div className="p-7">
                {error ? (
                  <div className="mb-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-[12px] font-bold text-red-700">
                    {error}
                  </div>
                ) : null}

                {tab === "smart" ? (
                  <div className="space-y-3">
                    <div className="text-[11px] font-black text-gray-400 tracking-widest uppercase">
                      Smart add
                    </div>
                    <input
                      ref={smartRef}
                      placeholder={smartHint}
                      className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                    />
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[11px] text-gray-400 font-medium">
                        Type: name, email, salary
                      </div>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={submitSmart}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-2xl px-5 py-3 text-sm font-black shadow-lg shadow-blue-200/30 disabled:opacity-60"
                      >
                        {isPending ? "..." : "Add"}
                      </button>
                    </div>
                  </div>
                ) : null}

                {tab === "manual" ? (
                  <form ref={manualRef} onSubmit={submitManual} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="sm:col-span-2">
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">
                        Full name
                      </label>
                      <input
                        name="full_name"
                        required
                        className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Email</label>
                      <input
                        name="email"
                        type="email"
                        className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Phone</label>
                      <input
                        name="phone"
                        className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                      />
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Salary</label>
                      {manualPeriod === "semi_monthly" ? (
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <input
                            name="salary_p1"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue="0"
                            placeholder="Half #1"
                            className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                          />
                          <input
                            name="salary_p2"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue="0"
                            placeholder="Half #2"
                            className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                          />
                        </div>
                      ) : manualPeriod === "quarterly" ? (
                        <div className="mt-2 grid grid-cols-2 gap-3">
                          <input
                            name="salary_p1"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue="0"
                            placeholder="Quarter #1"
                            className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                          />
                          <input
                            name="salary_p2"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue="0"
                            placeholder="Quarter #2"
                            className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                          />
                          <input
                            name="salary_p3"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue="0"
                            placeholder="Quarter #3"
                            className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                          />
                          <input
                            name="salary_p4"
                            type="number"
                            step="0.01"
                            min="0"
                            defaultValue="0"
                            placeholder="Quarter #4"
                            className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                          />
                        </div>
                      ) : (
                        <input
                          name="base_salary"
                          type="number"
                          step="0.01"
                          min="0"
                          defaultValue="0"
                          className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                        />
                      )}
                    </div>

                    <div>
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Period</label>
                      <select
                        name="salary_period"
                        value={manualPeriod}
                        onChange={(e) => setManualPeriod(e.target.value)}
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
                      <label className="text-[10px] font-black text-gray-400 tracking-widest uppercase">Rating</label>
                      <input
                        name="performance_rating"
                        type="number"
                        step="0.01"
                        min="0"
                        max="5"
                        defaultValue="0"
                        className="mt-2 w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                      />
                    </div>

                    <div className="sm:col-span-2 flex items-center justify-end gap-3 mt-2">
                      <button
                        type="button"
                        onClick={close}
                        className="rounded-2xl px-5 py-3 text-sm font-black text-gray-500 hover:bg-gray-50"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={isPending}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-2xl px-6 py-3 text-sm font-black shadow-lg shadow-blue-200/30 disabled:opacity-60"
                      >
                        {isPending ? "..." : "Save"}
                      </button>
                    </div>
                  </form>
                ) : null}

                {tab === "bulk" ? (
                  <div className="space-y-3">
                    <div className="text-[11px] font-black text-gray-400 tracking-widest uppercase">
                      Bulk add
                    </div>
                    <div className="text-[12px] text-gray-400 font-medium">
                      Per line: <span className="font-black text-gray-500">name | email | salary</span> (or commas)
                    </div>
                    <textarea
                      ref={bulkRef}
                      rows={6}
                      placeholder={`SULEMA LEMUS | sulema.l@georgetown.com | 2250\nYADIRA CRUZ, yadira.c@georgetown.com, 1800`}
                      className="w-full rounded-2xl border border-gray-100 bg-white px-5 py-4 text-sm font-medium focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10"
                    />
                    <div className="flex items-center justify-end gap-3">
                      <button type="button" onClick={close} className="rounded-2xl px-5 py-3 text-sm font-black text-gray-500 hover:bg-gray-50">
                        Cancel
                      </button>
                      <button
                        type="button"
                        disabled={isPending}
                        onClick={submitBulk}
                        className="bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-2xl px-6 py-3 text-sm font-black shadow-lg shadow-blue-200/30 disabled:opacity-60"
                      >
                        {isPending ? "..." : "Insert"}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

