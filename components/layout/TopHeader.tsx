"use client";

import Link from "next/link";
import { Menu, Settings, X } from "lucide-react";
import { useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { navigation } from "@/components/layout/Sidebar";

export function TopHeader() {
  const pathname = usePathname();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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

  // Close mobile menu on route change without using setState in an effect.
  // useSyncExternalStore is used here only as a stable subscription; the
  // real dependency is pathname which triggers a re-render.
  useSyncExternalStore(
    () => () => {},
    () => pathname,
  );
  // When pathname changes between renders the component re-renders and the
  // state initialiser below resets the menu. We keep the menu in a ref-like
  // derived state: if the pathname changed we reset it.
  const [prevPathname, setPrevPathname] = useState(pathname);
  if (pathname !== prevPathname) {
    setIsMobileMenuOpen(false);
    setPrevPathname(pathname);
  }

  return (
    <>
      <header className="h-16 w-full flex items-center justify-between px-3 sm:px-4 md:px-6 bg-white border-b border-gray-100 shrink-0">
        <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0">
          <button
            type="button"
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 -ml-1 text-gray-600 hover:text-gray-900 rounded-md md:hidden"
            aria-label="Open navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="text-sm font-medium flex items-center gap-1.5 sm:gap-2 min-w-0">
            <span className="text-gray-300 shrink-0">/</span>
            <span className="text-[#a48443] truncate">{breadcrumb}</span>
          </div>
        </div>

        <div className="flex items-center gap-1 sm:gap-2 md:gap-4">
          <button
            type="button"
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Open settings"
          >
            <Settings className="w-5 h-5" />
          </button>
          <div className="w-8 h-8 rounded-full bg-[#052e36] text-white flex items-center justify-center text-xs font-semibold">
            NY
          </div>
        </div>
      </header>

      <div
        className={`fixed inset-0 z-50 md:hidden transition-opacity duration-200 ${
          isMobileMenuOpen ? "opacity-100 pointer-events-auto" : "opacity-0 pointer-events-none"
        }`}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40"
          onClick={() => setIsMobileMenuOpen(false)}
          aria-label="Close navigation menu"
        />
        <aside
          className={`relative h-full w-72 max-w-[85vw] bg-[#052e36] text-white shadow-xl transform transition-transform duration-200 ${
            isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex items-center justify-between p-5 border-b border-white/10">
            <h2 className="text-2xl font-heading font-extrabold tracking-widest text-white flex items-baseline">
              NAYA<span className="text-[#a48443] leading-none ml-0.5">.</span>
            </h2>
            <button
              type="button"
              className="p-2 rounded-md text-gray-300 hover:text-white hover:bg-white/10"
              onClick={() => setIsMobileMenuOpen(false)}
              aria-label="Close navigation menu"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <nav className="px-3 py-5 space-y-2 overflow-y-auto h-[calc(100%-80px)]">
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
                  <span>{item.name}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
      </div>
    </>
  );
}
