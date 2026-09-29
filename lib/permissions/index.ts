import "server-only"

import { redirect } from "next/navigation"

import { getSession, type Session } from "@/lib/auth/session"

/** Disabled sessions are ended by a route handler, which can clear cookies. */
export const DISABLED_SIGN_OUT = "/auth/signout?reason=disabled"

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

/**
 * For signed-in pages: sends signed-out or disabled users to the login page.
 * The proxy already redirects visitors with no session, so a missing session here
 * means a login without a profile; ending it avoids a redirect loop via /login.
 */
export async function requireSession() {
  const session = await getSession()
  if (!session) redirect("/auth/signout")
  if (!session.profile.is_active) redirect(DISABLED_SIGN_OUT)
  return session
}

/** For /employee pages. Admins without an employee record are sent to /admin. */
export async function requireEmployee(): Promise<EmployeeSession> {
  const session = await requireSession()
  if (isActiveEmployee(session)) return session
  if (isAdmin(session)) redirect("/admin")
  redirect(DISABLED_SIGN_OUT)
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
