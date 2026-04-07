"use client";

import { Menu, Settings } from "lucide-react";
import { usePathname } from "next/navigation";

export function TopHeader() {
  const pathname = usePathname();

  // Simple logic to derive the breadcrumb text from the path, for the first demo
  let breadcrumb = "Dashboard";
  if (pathname === "/") {
    breadcrumb = "Dashboard";
  } else if (pathname.includes("georgetown")) {
    breadcrumb = "Georgetown";
  } else if (pathname.includes("wharf-maine")) {
    breadcrumb = "Wharf Maine";
  } else if (pathname.includes("pennsylvania")) {
    breadcrumb = "Pennsylvania Ave";
  } else {
    // try formatting other paths
    const pathSegments = pathname.split("/").filter(Boolean);
    if (pathSegments.length > 0) {
      breadcrumb = pathSegments[0].charAt(0).toUpperCase() + pathSegments[0].slice(1);
    }
  }

  return (
    <header className="h-16 w-full flex items-center justify-between px-6 bg-white border-b border-gray-100 flex-shrink-0">
      <div className="flex items-center gap-4">
        <button className="p-2 -ml-2 text-gray-600 hover:text-gray-900 rounded-md">
          <Menu className="w-5 h-5" />
        </button>
        <div className="text-sm font-medium flex items-center gap-2">
          <span className="text-gray-300">/</span>
          <span className="text-[#a48443]">{breadcrumb}</span>
        </div>
      </div>

      <div className="flex items-center gap-4">
        <button className="p-2 text-gray-400 hover:text-gray-600 transition-colors">
          <Settings className="w-5 h-5" />
        </button>
        <div className="w-8 h-8 rounded-full bg-[#052e36] text-white flex items-center justify-center text-xs font-semibold">
          NY
        </div>
      </div>
    </header>
  );
}
