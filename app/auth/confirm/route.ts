import type { EmailOtpType } from "@supabase/supabase-js"
import { type NextRequest, NextResponse } from "next/server"

import { safeNextPath } from "@/lib/auth/access"
import { createClient } from "@/lib/supabase/server"

const ALLOWED_TYPES: EmailOtpType[] = ["invite", "recovery", "email", "magiclink"]

/**
 * Landing point for links in Supabase Auth emails (invites and password resets).
 * Exchanges the one-time token for a session, then continues to `next`.
 * The email templates must link here; see README > Email templates.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = safeNextPath(searchParams.get("next")) ?? "/"

  if (tokenHash && type && ALLOWED_TYPES.includes(type)) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })
    if (!error) {
      const destination = new URL(next, request.url)
      if (type === "invite") destination.searchParams.set("mode", "invite")
      return NextResponse.redirect(destination)
    }
  }

  return NextResponse.redirect(new URL("/login?error=link", request.url))
}
