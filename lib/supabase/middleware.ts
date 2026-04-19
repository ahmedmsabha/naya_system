import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { resolveTenantContextFromPath } from '@/lib/auth/tenant-context'

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

  if (!user && !isAuthPage) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && isAuthPage && !isPasswordUpdatePage) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
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
