"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useTransition } from "react";

/** Same `?date=` contract as Warehouse Overview: week shown is the Monday–Sunday week containing this anchor day. */
export function ScheduleDateNav({
  branchId,
  anchorIso,
  weekStartIso,
  weekEndIso,
}: {
  branchId: string;
  anchorIso: string;
  weekStartIso: string;
  weekEndIso: string;
}) {
  const router = useRouter();
  const [isNavigating, startNavigating] = useTransition();

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      <label className="flex items-center gap-2 font-bold text-gray-600">
        <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">Week anchor</span>
        <input
          type="date"
          value={anchorIso}
          disabled={isNavigating}
          onChange={(e) => {
            const v = e.target.value;
            if (v) {
              startNavigating(() => {
                router.push(`/branch/${branchId}/warehouse/schedule?date=${v}`);
              });
            }
          }}
          className="rounded-xl border border-gray-200 px-3 py-2 font-black text-[#052e36] bg-white"
        />
        {isNavigating ? <Loader2 className="w-3.5 h-3.5 animate-spin text-[#2563eb]" /> : null}
      </label>
      <div className="text-[12px] font-bold text-gray-400">
        <span className="text-gray-500">ISO:</span> {weekStartIso} → {weekEndIso}
      </div>
      <Link
        href={`/branch/${branchId}/warehouse?date=${anchorIso}`}
        className="text-[11px] font-black text-[#2563eb] hover:underline uppercase tracking-wide"
      >
        Same anchor in Overview
      </Link>
    </div>
  );
}
