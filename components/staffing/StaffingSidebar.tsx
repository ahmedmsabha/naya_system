"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Users, RefreshCcw, BadgeCheck } from "lucide-react";

const navItems = [
  { label: "Overview", icon: LayoutDashboard, segment: "" },
  { label: "Employees", icon: Users, segment: "" },
];

export function StaffingSidebar({ branchId }: { branchId: string }) {
  const pathname = usePathname();
  const base = `/branch/${branchId}/staffing`;

  return (
    <div className="flex flex-col w-[220px] shrink-0 bg-white border-l border-gray-100 h-full py-8 px-4 gap-1.5 shadow-[inset_1px_0_0_0_rgba(0,0,0,0.02)]">
      <div className="px-3 mb-10 flex flex-col gap-1">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 bg-[#052e36] rounded-xl flex items-center justify-center shadow-lg shadow-teal-900/20">
            <BadgeCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-black text-[#052e36] tracking-widest text-base">NAYA</span>
        </div>
        <span className="text-[10px] font-bold text-gray-300 tracking-[.3em] uppercase ml-12">Operations</span>
      </div>

      <div className="flex flex-col gap-2">
        <p className="px-3 text-[10px] font-black text-gray-400 tracking-widest uppercase mb-2">Main Menu</p>

        {navItems.map((item) => {
          const href = item.segment ? `${base}/${item.segment}` : base;
          const isActive = pathname === base || pathname === base + "/";
          return (
            <Link
              key={item.label}
              href={href}
              prefetch={true}
              className={`flex items-center gap-3 px-4 py-3 rounded-2xl text-sm font-bold transition-all duration-200 group ${
                isActive ? "bg-[#2563eb] text-white shadow-lg shadow-blue-200" : "text-gray-400 hover:text-[#052e36] hover:bg-gray-50/80"
              }`}
            >
              <item.icon className={`w-5 h-5 shrink-0 transition-transform ${isActive ? "scale-110" : "group-hover:scale-110"}`} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="mt-auto pt-8 border-t border-gray-50 flex flex-col gap-3">
        <div className="px-3 text-[10px] font-black text-gray-200 tracking-widest uppercase">V1.0.4</div>
        <div className="px-3 text-[10px] font-bold text-gray-300 uppercase tracking-widest flex items-center gap-2">
          <RefreshCcw className="w-3.5 h-3.5" />
          Staffing
        </div>
      </div>
    </div>
  );
}

