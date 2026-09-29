import { type NextRequest, NextResponse } from "next/server"

import { createClient } from "@/lib/supabase/server"

const REASONS = new Set(["disabled"])

/**
 * Ends the session and returns to the login page. Pages send disabled accounts
 * here because Server Components cannot clear cookies themselves; without this the
 * still-valid session would bounce between /login and the portal.
 */
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  await supabase.auth.signOut()
  const reason = request.nextUrl.searchParams.get("reason")
  const target = new URL("/login", request.url)
  if (reason && REASONS.has(reason)) target.searchParams.set("error", reason)
  return NextResponse.redirect(target, { headers: { "Cache-Control": "no-store" } })
}
