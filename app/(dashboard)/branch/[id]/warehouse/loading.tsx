"use client";

import { Loader2 } from "lucide-react";

export default function WarehouseLoading() {
  return (
    <div className="flex min-h-[320px] items-center justify-center" dir="ltr">
      <div className="inline-flex items-center gap-3 rounded-2xl border border-gray-100 bg-white px-5 py-3 shadow-sm">
        <Loader2 className="h-4 w-4 animate-spin text-[#2563eb]" />
        <span className="text-sm font-bold text-[#052e36]">Loading warehouse data...</span>
      </div>
    </div>
  );
}
