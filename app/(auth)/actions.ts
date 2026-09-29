"use server"

import { redirect } from "next/navigation"

import { homeFor } from "@/lib/auth/access"
import { publicEnv } from "@/lib/env"
import { createClient } from "@/lib/supabase/server"
import { invalid, logServerError } from "@/lib/utils/errors"
import {
  type ForgotPasswordInput,
  forgotPasswordSchema,
  type LoginInput,
  loginSchema,
  type ResetPasswordInput,
  resetPasswordSchema,
} from "@/lib/validations/auth"
import type { ActionResult } from "@/types/actions"

// Deliberately vague: never reveal whether an email has an account.
const INVALID_LOGIN = "Invalid email or password."

export async function signIn(input: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signInWithPassword({
    email: parsed.data.email,
    password: parsed.data.password,
  })

  if (error || !data.user) {
    if (error?.code === "over_request_rate_limit") {
      return { ok: false, error: "Too many attempts. Please wait a few minutes and try again." }
    }
    return { ok: false, error: INVALID_LOGIN }
  }

  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from("profiles").select("role, is_active").eq("id", data.user.id).maybeSingle(),
    supabase.from("employees").select("id").eq("profile_id", data.user.id).maybeSingle(),
  ])

  if (!profile?.is_active) {
    await supabase.auth.signOut()
    return { ok: false, error: "Your account has been disabled. Please contact HR." }
  }

  const { error: logError } = await supabase.rpc("record_sign_in")
  if (logError) logServerError("record sign-in", logError)

  redirect(homeFor(profile.role, Boolean(employee), parsed.data.next))
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}

export async function requestPasswordReset(input: ForgotPasswordInput): Promise<ActionResult> {
  const parsed = forgotPasswordSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)

  const supabase = await createClient()
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
  })
  if (error && error.code !== "over_email_send_rate_limit") logServerError("password reset email", error)

  // Same answer whether or not the account exists.
  return {
    ok: true,
    data: undefined,
    message: "If an account exists for that email, we've sent a link to reset your password.",
  }
}

export async function updatePassword(input: ResetPasswordInput): Promise<ActionResult> {
  const parsed = resetPasswordSchema.safeParse(input)
  if (!parsed.success) return invalid(parsed.error)

  const supabase = await createClient()
  const { data: claims } = await supabase.auth.getClaims()
  if (!claims?.claims?.sub) {
    return { ok: false, error: "This link has expired. Please request a new password reset email." }
  }

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password })
  if (error) {
    if (error.code === "same_password") {
      return { ok: false, error: "Choose a password that is different from your current one." }
    }
    if (error.code === "weak_password") {
      return { ok: false, error: "That password is too weak. Use at least 10 characters with upper and lower case letters and a number." }
    }
    logServerError("update password", error)
    return { ok: false, error: "We couldn't update your password. Please try again." }
  }

  const [{ data: profile }, { data: employee }] = await Promise.all([
    supabase.from("profiles").select("role, is_active").eq("id", claims.claims.sub).maybeSingle(),
    supabase.from("employees").select("id").eq("profile_id", claims.claims.sub).maybeSingle(),
  ])
  if (!profile?.is_active) {
    await supabase.auth.signOut()
    redirect("/login?error=disabled")
  }
  redirect(homeFor(profile.role, Boolean(employee)))
}
