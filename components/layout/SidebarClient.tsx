"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, LogOut } from "lucide-react";
import { LogoutConfirmButton } from "@/components/layout/LogoutConfirmButton";
import { dashboardNavIcons } from "@/components/layout/dashboard-nav-icons";
import type { DashboardNavItem } from "@/lib/navigation/dashboard-nav";

function isLinkActive(pathname: string, href: string): boolean {
  if (href === "/") {
    return pathname === "/";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

type SidebarClientProps = {
  items: DashboardNavItem[];
};

export function SidebarClient({ items }: SidebarClientProps) {
  const pathname = usePathname();

  return (
    <div className="hidden md:flex md:flex-col h-screen w-64 bg-[#052e36] text-white shrink-0 font-sans">
      <div className="p-6">
        <h1 className="text-3xl font-heading font-extrabold tracking-widest text-white flex items-baseline">
          NAYA<span className="text-[#a48443] leading-none ml-0.5">.</span>
        </h1>
      </div>

      <nav className="flex-1 px-4 py-8 space-y-2 overflow-y-auto">
        {items.length === 0 ? (
          <p className="px-4 text-xs text-gray-500">No navigation available for this account.</p>
        ) : (
          items.map((item) => {
            const isActive = isLinkActive(pathname, item.href);
            const Icon = dashboardNavIcons[item.icon] ?? LayoutDashboard;
            return (
              <Link
                key={item.name + item.href}
                href={item.href}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors w-full ${
                  isActive
                    ? "bg-[#d2ae6d] text-[#052e36]"
                    : "text-gray-300 hover:text-white hover:bg-white/10"
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="shrink-0 min-w-0 flex-1">{item.name}</span>
                {item.badgeCount != null && item.badgeCount > 0 ? (
                  <span className="shrink-0 min-w-6 h-6 rounded-full bg-rose-500 text-white text-xs font-bold flex items-center justify-center">
                    {item.badgeCount > 99 ? "99+" : item.badgeCount}
                  </span>
                ) : null}
              </Link>
            );
          })
        )}
      </nav>

      <div className="p-4 px-8 mt-auto">
        <LogoutConfirmButton
          triggerClassName="flex items-center gap-3 text-sm font-medium text-gray-300 hover:text-white transition-colors"
          icon={<LogOut className="w-5 h-5" />}
        />
      </div>
    </div>
  );
}
