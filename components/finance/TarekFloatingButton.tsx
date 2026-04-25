"use client";

import { Wallet, Sparkles } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type TarekFloatingButtonProps = {
  /** When false, the control is not rendered (not only hidden — removed from the DOM). */
  canUseAccountant: boolean;
};

export function TarekFloatingButton({ canUseAccountant }: TarekFloatingButtonProps) {
  if (!canUseAccountant) {
    return null;
  }

  const pathname = usePathname();
  
  // Only show on the main dashboard page
  if (pathname !== "/") return null;

  return (
    <Link
      href="/accountant"
      className="fixed bottom-10 right-10 z-[80] group flex items-center gap-4 active:scale-95 transition-all"
    >
      <div className="absolute right-0 w-[240px] opacity-0 group-hover:opacity-100 group-hover:-translate-x-16 transition-all duration-500 pointer-events-none">
        <div className="bg-[#052e36] text-white p-4 rounded-3xl shadow-2xl border border-white/10 backdrop-blur-xl">
           <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Open Now</p>
           <h4 className="text-sm font-black text-white uppercase tracking-tight leading-none italic">Tarek Smart Accountant ✨</h4>
        </div>
      </div>

      <div className="w-20 h-20 bg-[#2563eb] rounded-[2rem] flex items-center justify-center text-white shadow-[0_20px_50px_rgba(37,99,235,0.4)] hover:shadow-[0_20px_50px_rgba(37,90,230,0.6)] group-hover:rotate-[360deg] transition-all duration-700 relative overflow-hidden">
        <Wallet className="w-8 h-8 relative z-10" />
        <div className="absolute inset-0 bg-gradient-to-tr from-[#6366f1] to-[#2563eb] opacity-0 group-hover:opacity-100 transition-opacity" />
        <div className="absolute -top-1 -right-1 w-6 h-6 bg-white rounded-full flex items-center justify-center animate-bounce">
           <Sparkles className="w-3 h-3 text-[#2563eb]" />
        </div>
      </div>
    </Link>
  );
}
