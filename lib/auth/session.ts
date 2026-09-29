import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

export type Session = {
  userId: string
  profile: {
    id: string
    role: "admin" | "employee"
    full_name: string
    email: string
    is_active: boolean
  }
  employee: {
    id: string
    employee_code: string
    first_name: string
    last_name: string
    status: "active" | "inactive"
  } | null
}

/**
 * The signed-in user's profile and employee record, loaded once per request.
 * Returns null when nobody is signed in.
 */
export const getSession = cache(async (): Promise<Session | null> => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const userId = data?.claims?.sub
  if (!userId) return null

  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from("profiles").select("id, role, full_name, email, is_active").eq("id", userId).maybeSingle(),
    supabase
      .from("employees")
      .select("id, employee_code, first_name, last_name, status")
      .eq("profile_id", userId)
      .maybeSingle(),
  ])
  if (!profile) return null

  return { userId, profile, employee: employee ?? null }
})

export function displayName(session: Session) {
  if (session.employee) return `${session.employee.first_name} ${session.employee.last_name}`
  return session.profile.full_name || session.profile.email
}
