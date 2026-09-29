import { redirect } from "next/navigation"

import { homeFor } from "@/lib/auth/access"
import { getSession } from "@/lib/auth/session"
import { DISABLED_SIGN_OUT } from "@/lib/permissions"

/** Sends each person to their portal: admins to /admin, employees to /employee. */
export default async function Home() {
  const session = await getSession()
  // Also ends a session that has no profile, so it cannot loop through /login.
  if (!session) redirect("/auth/signout")
  if (!session.profile.is_active) redirect(DISABLED_SIGN_OUT)
  redirect(homeFor(session.profile.role, Boolean(session.employee)))
}
