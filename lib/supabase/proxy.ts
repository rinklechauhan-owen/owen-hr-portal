import { createServerClient } from "@supabase/ssr"
import { type NextRequest, NextResponse } from "next/server"

import { decideRouteAccess } from "@/lib/auth/access"
import { publicEnv } from "@/lib/env"
import type { Database } from "@/types/database"

/**
 * Refreshes the Supabase session cookie on every request and applies the basic
 * signed-in / signed-out redirects. Role checks happen in the layouts and actions.
 */
export async function updateSession(request: NextRequest) {
  const env = publicEnv()
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
        response = NextResponse.next({ request })
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options))
        Object.entries(headers ?? {}).forEach(([key, value]) => response.headers.set(key, value))
      },
    },
  })

  // Do not run other code between creating the client and getClaims(): it is what
  // refreshes an expired session. getClaims() verifies the JWT; getSession() would not.
  const { data } = await supabase.auth.getClaims()
  const isSignedIn = Boolean(data?.claims?.sub)

  const decision = decideRouteAccess(request.nextUrl.pathname, request.nextUrl.search, isSignedIn)
  if (decision.type === "redirect") {
    const redirect = NextResponse.redirect(new URL(decision.to, request.url))
    // Keep any refreshed session cookies.
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie))
    return redirect
  }
  return response
}
