import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveTenantContextFromPath } from '@/lib/auth/tenant-context'

/**
 * Global / administration surfaces (not tied to a single branch in the URL).
 * Non–super-admins are redirected to their assigned branch dashboard.
 * Must match `lib/auth/authorize` expectations for `super_admin` vs branch roles.
 */
const GLOBAL_ADMIN_PATH_PREFIXES = ['/investor', '/accountant', '/settings'] as const

function isGlobalOrAdminPath(pathname: string): boolean {
  if (pathname === '/') {
    return true
  }
  for (const prefix of GLOBAL_ADMIN_PATH_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
      return true
    }
  }
  return false
}

function redirectWithSessionCookies(
  from: NextResponse,
  to: NextResponse
): NextResponse {
  from.cookies.getAll().forEach((cookie) => {
    to.cookies.set(cookie.name, cookie.value)
  })
  return to
}

function withContextHeaders(request: NextRequest, response: NextResponse) {
  const requestHeaders = new Headers(request.headers)
  const { branchId, warehouseId } = resolveTenantContextFromPath(request.nextUrl.pathname)
  const authzMode = process.env.AUTHZ_MODE?.toLowerCase() ?? 'compat'

  requestHeaders.set('x-naya-authz-mode', authzMode)

  if (branchId) requestHeaders.set('x-naya-branch-id', branchId)
  else requestHeaders.delete('x-naya-branch-id')

  if (warehouseId) requestHeaders.set('x-naya-warehouse-id', warehouseId)
  else requestHeaders.delete('x-naya-warehouse-id')

  const enrichedResponse = NextResponse.next({
    request: {
      headers: requestHeaders,
    },
  })

  response.cookies.getAll().forEach((cookie) => {
    enrichedResponse.cookies.set(cookie.name, cookie.value)
  })

  return enrichedResponse
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  // With Fluid compute, don't put this client in a global environment
  // variable. Always create a new one on each request.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Do not run code between createServerClient and
  // supabase.auth.getClaims(). A simple mistake could make it very hard to debug
  // issues with users being randomly logged out.

  const pathname = request.nextUrl.pathname
  const isAuthPage =
    pathname.startsWith('/login') ||
    pathname.startsWith('/forgot-password') ||
    pathname.startsWith('/phone-login') ||
    pathname.startsWith('/update-password')
  const isPasswordUpdatePage = pathname.startsWith('/update-password')

  // getUser is the canonical auth check for protected routes.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isServerAction =
    request.method === 'POST' &&
    (request.headers.has('next-action') ||
      request.headers.has('x-action') ||
      request.headers.get('content-type')?.includes('multipart/form-data') === true)

  // For Server Actions, a redirect response breaks the action protocol and surfaces in the UI as:
  // "An unexpected response was received from the server."
  // Let the request continue so the action can return a typed error payload instead.
  if (!user && !isAuthPage && !isServerAction) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage && !isPasswordUpdatePage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  if (user && !isServerAction) {
    const metadata = (user.user_metadata ?? {}) as Record<string, unknown>
    const role = typeof metadata.role === 'string' ? metadata.role : ''
    const branchId = typeof metadata.branch_id === 'string' ? metadata.branch_id.trim() : null

    if (role !== 'super_admin' && isGlobalOrAdminPath(pathname)) {
      if (!branchId) {
        const dest = request.nextUrl.clone()
        dest.pathname = '/login'
        dest.searchParams.set('error', 'Invalid Account Setup')
        return redirectWithSessionCookies(
          supabaseResponse,
          NextResponse.redirect(dest)
        )
      }
      const dest = request.nextUrl.clone()
      dest.pathname = `/branch/${branchId}`
      return redirectWithSessionCookies(
        supabaseResponse,
        NextResponse.redirect(dest)
      )
    }
  }

  // IMPORTANT: You *must* return the supabaseResponse object as it is.
  // If you're creating a new response object with NextResponse.next() make sure to:
  // 1. Pass the request in it, like so:
  //    const myNewResponse = NextResponse.next({ request })
  // 2. Copy over the cookies, like so:
  //    myNewResponse.cookies.setAll(supabaseResponse.cookies.getAll())
  // 3. Change the myNewResponse object to fit your needs, but avoid changing
  //    the cookies!
  // 4. Finally:
  //    return myNewResponse
  // If this is not done, you may be causing the browser and server to go out
  // of sync and terminate the user's session prematurely!

  return withContextHeaders(request, supabaseResponse)
}
