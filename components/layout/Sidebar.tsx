"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Target,
  BarChart3,
  Warehouse,
  Users,
  LogOut,
  Wallet,
} from "lucide-react";

const navigation = [
  { name: "Management", href: "/", icon: LayoutDashboard },
  { name: "Smart Accountant", href: "/accountant", icon: Wallet },
  { name: "Investor View", href: "/investor", icon: Target },
  { name: "Financials", href: "/financials", icon: BarChart3 },
  { name: "Warehouse", href: "/warehouse", icon: Warehouse },
  { name: "Staffing", href: "/staffing", icon: Users },
];

export { navigation };

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex md:flex-col h-screen w-64 bg-[#052e36] text-white shrink-0 font-sans">
      <div className="p-6">
        <h1 className="text-3xl font-heading font-extrabold tracking-widest text-white flex items-baseline">
          NAYA<span className="text-[#a48443] leading-none ml-0.5">.</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
        {navigation.map((item) => {
          const isActive = pathname === item.href || (pathname.startsWith(item.href) && item.href !== "/");
          return (
            <Link
              key={item.name}
              href={item.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? "bg-[#d2ae6d] text-[#052e36]"
                  : "text-gray-300 hover:text-white hover:bg-white/10"
              }`}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              <span className="shrink-0">{item.name}</span>
            </Link>
          );
        })}
      </nav>

      <div className="p-4 px-8 mt-auto">
        <button className="flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white transition-colors">
          <LogOut className="w-5 h-5" />
          Log Out
        </button>
      </div>
    </div>
  );
}
