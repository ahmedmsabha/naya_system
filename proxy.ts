/**
 * Next.js 16 request boundary (replaces `middleware.ts` at the project root).
 * Global route protection + Supabase session refresh are implemented in
 * `lib/supabase/middleware.ts` → `updateSession`.
 */
import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
