"use client";

import { useRef, useState, useTransition } from "react";
import { addIngredient } from "@/app/(dashboard)/branch/[id]/warehouse/actions";
import { PlusCircle, Loader2 } from "lucide-react";

export function AddItemForm({ branchId }: { branchId: string }) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const fd = new FormData(e.currentTarget);
    fd.set("branch_id", branchId);
    startTransition(async () => {
      const result = await addIngredient(fd);
      if (result?.error) {
        setError(result.error);
      } else {
        setSuccess(true);
        formRef.current?.reset();
        setTimeout(() => setSuccess(false), 2000);
      }
    });
  };

  return (
    <div
      className="w-full bg-[#052e36] rounded-[2rem] p-6 flex flex-col gap-6 shadow-2xl shadow-teal-900/40 relative overflow-hidden"
      dir="ltr"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -mr-16 -mt-16 blur-3xl pointer-events-none" />

      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-2xl bg-white/5 flex items-center justify-center border border-white/10">
           <PlusCircle className="w-5 h-5 text-[#2563eb]" />
        </div>
        <div className="flex flex-col">
          <span className="text-white font-black text-sm tracking-tight">Add Product</span>
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">New Entry</span>
        </div>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="flex flex-col gap-5">
        {/* Name */}
        <div className="flex flex-col gap-2">
          <label className="text-[10px] font-black text-gray-400 tracking-[.2em] uppercase ml-1">Product Name</label>
          <input
            name="name"
            type="text"
            placeholder="e.g. Falafel Mix"
            required
            className="bg-[#0a3f4a] text-white placeholder-gray-500 rounded-2xl px-5 py-4 text-sm font-medium border border-white/5 focus:outline-none focus:border-[#2563eb] focus:ring-4 focus:ring-[#2563eb]/10 transition-all"
          />
        </div>

        {/* Price + Unit row */}
        <div className="flex gap-4">
          <div className="flex flex-col gap-2 flex-1">
            <label className="text-[10px] font-black text-gray-400 tracking-[.2em] uppercase ml-1">Price ($)</label>
            <input
              name="cost_per_unit"
              type="number"
              step="0.01"
              min="0"
              defaultValue="0.00"
              inputMode="decimal"
              className="bg-[#0a3f4a] text-white rounded-2xl px-5 py-4 text-sm font-medium border border-white/5 focus:outline-none focus:border-[#2563eb] transition-all w-full"
            />
          </div>
          <div className="flex flex-col gap-2 w-24">
            <label className="text-[10px] font-black text-gray-400 tracking-[.2em] uppercase ml-1">Unit</label>
            <input
              name="unit"
              type="text"
              defaultValue="PCS"
              className="bg-[#0a3f4a] text-white rounded-2xl px-5 py-4 text-sm font-medium border border-white/5 focus:outline-none focus:border-[#2563eb] transition-all w-full uppercase text-center"
            />
          </div>
        </div>

        {error && (
          <p className="text-red-400 text-[11px] font-bold bg-red-400/10 p-3 rounded-xl border border-red-400/20">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full bg-[#2563eb] hover:bg-[#1d4ed8] text-white rounded-2xl py-4 text-sm font-black transition-all disabled:opacity-60 shadow-lg shadow-blue-200/20 flex items-center justify-center gap-2 active:scale-[0.98]"
        >
          {isPending ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : success ? (
            "Successfully Added"
          ) : (
            "Confirm Add Product"
          )}
        </button>
      </form>
    </div>
  );
}
