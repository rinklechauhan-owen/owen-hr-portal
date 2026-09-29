import type { Metadata } from "next"

import { LoginForm } from "@/components/forms/login-form"
import { safeNextPath } from "@/lib/auth/access"

export const metadata: Metadata = { title: "Log in" }

const NOTICES: Record<string, string> = {
  disabled: "Your account has been disabled. Please contact HR.",
  link: "That link is invalid or has expired. Please request a new one.",
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams
  const next = safeNextPath(typeof params.next === "string" ? params.next : null) ?? undefined
  const notice = typeof params.error === "string" ? NOTICES[params.error] : undefined

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">Welcome back</h1>
        <p className="text-sm text-muted-foreground">Log in with your Owen Media work email.</p>
      </div>
      <LoginForm next={next} notice={notice} />
    </div>
  )
}
