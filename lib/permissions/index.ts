import "server-only"

import { redirect } from "next/navigation"

import { getSession, type Session } from "@/lib/auth/session"

// Page and action guards. They give clear redirects and messages; Row Level
// Security still enforces the same rules in the database.

export type AdminSession = Session & { profile: Session["profile"] & { role: "admin" } }
export type EmployeeSession = Session & { employee: NonNullable<Session["employee"]> }

export function isAdmin(session: Session | null): session is AdminSession {
  return Boolean(session?.profile.is_active && session.profile.role === "admin")
}

export function isActiveEmployee(session: Session | null): session is EmployeeSession {
  return Boolean(session?.profile.is_active && session.employee?.status === "active")
}

/** For signed-in pages: sends signed-out or disabled users to the login page. */
export async function requireSession() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!session.profile.is_active) redirect("/login?error=disabled")
  return session
}

/** For /employee pages. Admins without an employee record are sent to /admin. */
export async function requireEmployee(): Promise<EmployeeSession> {
  const session = await requireSession()
  if (isActiveEmployee(session)) return session
  if (isAdmin(session)) redirect("/admin")
  redirect("/login?error=disabled")
}

export class ActionError extends Error {}

/** For Server Actions that only admins may run. */
export async function authorizeAdmin(): Promise<AdminSession> {
  const session = await getSession()
  if (!isAdmin(session)) throw new ActionError("You don't have permission to do that.")
  return session
}

/** For Server Actions an active employee runs on their own records. */
export async function authorizeEmployee(): Promise<EmployeeSession> {
  const session = await getSession()
  if (!isActiveEmployee(session)) throw new ActionError("Your account is not active. Please contact HR.")
  return session
}
