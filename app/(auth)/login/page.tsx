import Image from "next/image";
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="flex w-full h-screen">
      {/* LEFT SIDE - IMAGE */}
      <div className="hidden lg:flex w-1/2 relative bg-gray-900 h-full overflow-hidden">
        <Image
          src="/login-bg.png"
          alt="Naya Enterprise Culinary Operations"
          fill
          className="object-cover opacity-80"
          priority
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/30" />

        <div className="absolute inset-0 p-16 flex flex-col justify-end text-white">
          <h2 className="text-4xl font-heading font-black tracking-tight mb-4 leading-tight">
            Elevate Your F&B<br/>Operations
          </h2>
          <p className="text-gray-300 max-w-md text-lg leading-relaxed">
            Naya Enterprise connects your commissary with every branch in real-time. Manage inventory, staff, and profitability all in one place.
          </p>
        </div>
      </div>

      {/* RIGHT SIDE - FORM */}
      <div className="w-full lg:w-1/2 h-full flex flex-col items-center justify-center p-8 bg-white overflow-y-auto">
        <div className="w-full max-w-md space-y-12">

          <div className="text-center">
            <h1 className="text-4xl font-heading font-extrabold tracking-widest text-[#052e36] mb-3">
              NAYA<span className="text-[#a48443]">.</span>
            </h1>
            <p className="text-sm font-bold tracking-widest text-gray-400 uppercase">
              Operations Hub
            </p>
          </div>

          <div className="space-y-6">
            <div className="space-y-2 text-center">
              <h3 className="text-2xl font-bold text-gray-900">Sign in</h3>
              <p className="text-sm text-gray-500">
                Enter your professional credentials to access your dashboard.
              </p>
            </div>

            <div className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-gray-600 block">
                  Work Email
                </label>
                <input
                  type="email"
                  placeholder="name@company.com"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e36] transition-all text-sm"
                />
              </div>

              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-sm font-semibold text-gray-600 block">
                    Password
                  </label>
                  <Link href="#" className="text-xs font-semibold text-[#a48443] hover:text-[#8b6f39] transition-colors">
                    Forgot Password?
                  </Link>
                </div>
                <input
                  type="password"
                  placeholder="••••••••"
                  className="w-full h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#052e36] transition-all text-sm"
                />
              </div>
            </div>

            <Link href="/" className="block">
              <Button className="w-full h-12 bg-[#052e36] text-white hover:bg-[#08434f] rounded-xl font-bold text-[15px] mt-4 shadow-md focus:ring-2 focus:ring-offset-2 focus:ring-[#052e36]">
                Secure Sign In
              </Button>
            </Link>

            <p className="text-xs text-center text-gray-400 font-medium">
              By signing in, you agree to Naya&apos;s Terms of Service and Privacy Policy.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
