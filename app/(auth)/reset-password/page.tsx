import type { Metadata } from "next"
import Link from "next/link"

import { ResetPasswordForm } from "@/components/forms/reset-password-form"
import { FormAlert } from "@/components/forms/form-alert"
import { buttonVariants } from "@/components/ui/button"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Choose a password" }

// Reached from the invite or password-reset email via /auth/confirm, which signs
// the user in with a one-time token first.
export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { mode } = await searchParams
  const isInvite = mode === "invite"
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()

  if (!data?.claims?.sub) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Link expired</h1>
        <FormAlert message="This link is invalid or has expired. Links can only be used once." />
        <Link href="/forgot-password" className={buttonVariants({ size: "lg", className: "w-full" })}>
          Request a new link
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1.5">
        <h1 className="text-2xl font-semibold">{isInvite ? "Welcome to Owen HR" : "Choose a new password"}</h1>
        <p className="text-sm text-muted-foreground">
          {isInvite ? "Set a password to finish setting up your account." : "Your new password replaces the old one."}
        </p>
      </div>
      <ResetPasswordForm submitLabel={isInvite ? "Set password and continue" : "Update password"} />
    </div>
  )
}
