import { redirect } from "next/navigation"

import { homeFor } from "@/lib/auth/access"
import { getSession } from "@/lib/auth/session"

/** Sends each person to their portal: admins to /admin, employees to /employee. */
export default async function Home() {
  const session = await getSession()
  if (!session) redirect("/login")
  if (!session.profile.is_active) redirect("/login?error=disabled")
  redirect(homeFor(session.profile.role, Boolean(session.employee)))
}
