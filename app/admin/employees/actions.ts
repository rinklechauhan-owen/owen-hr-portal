"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { publicEnv } from "@/lib/env"
import { authorizeAdmin } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { fail, invalid, logServerError } from "@/lib/utils/errors"
import { type EmployeeInput, employeeSchema, employeeToRow } from "@/lib/validations/employee"
import type { ActionResult } from "@/types/actions"

const idSchema = z.uuid()
// Supabase has no "ban forever"; 100 years is the conventional equivalent.
const BLOCKED = "876000h"

function inviteRedirect() {
  return `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`
}

export async function createEmployee(input: EmployeeInput): Promise<ActionResult<{ id: string }>> {
  try {
    await authorizeAdmin()
    const parsed = employeeSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    const supabase = await createClient()
    const { data, error } = await supabase.from("employees").insert(employeeToRow(parsed.data)).select("id").single()
    if (error) return fail(error, "create employee")

    revalidatePath("/admin/employees")
    return { ok: true, data: { id: data.id }, message: "Employee added." }
  } catch (error) {
    return fail(error, "create employee")
  }
}

export async function updateEmployee(id: string, input: EmployeeInput): Promise<ActionResult> {
  try {
    const session = await authorizeAdmin()
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Employee not found." }
    const parsed = employeeSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    const supabase = await createClient()
    const { data: current, error: loadError } = await supabase
      .from("employees")
      .select("email, profile_id, profile:profiles(role)")
      .eq("id", id)
      .maybeSingle()
    if (loadError) return fail(loadError, "load employee")
    if (!current) return { ok: false, error: "Employee not found." }

    // Keep the login email in step with the HR record.
    if (current.profile_id && current.email !== parsed.data.email) {
      // Changing another admin's login email, then sending a reset, would let one
      // admin take over another's account.
      if (current.profile?.role === "admin" && current.profile_id !== session.userId) {
        return { ok: false, error: "Only that administrator can change their own login email." }
      }
      const { error: authError } = await createAdminClient().auth.admin.updateUserById(current.profile_id, {
        email: parsed.data.email,
        email_confirm: true,
      })
      if (authError) {
        if (authError.code === "email_exists") return { ok: false, error: "Another account already uses this email." }
        return fail(authError, "update login email")
      }
    }

    const { error } = await supabase.from("employees").update(employeeToRow(parsed.data)).eq("id", id)
    if (error) return fail(error, "update employee")

    revalidatePath("/admin/employees")
    revalidatePath(`/admin/employees/${id}`)
    return { ok: true, data: undefined, message: "Employee updated." }
  } catch (error) {
    return fail(error, "update employee")
  }
}

/** Disabling keeps every record but removes access immediately. */
export async function setEmployeeStatus(id: string, status: "active" | "inactive"): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    if (!idSchema.safeParse(id).success || !["active", "inactive"].includes(status)) {
      return { ok: false, error: "Employee not found." }
    }

    const supabase = await createClient()
    // RLS and the database guard (no self-disabling) apply to this update. The
    // linked profile's access flag follows automatically, which is what RLS checks.
    const { data, error } = await supabase
      .from("employees")
      .update({ status })
      .eq("id", id)
      .select("profile_id")
      .maybeSingle()
    if (error) return fail(error, "change employee status")
    if (!data) return { ok: false, error: "Employee not found." }

    let message = status === "inactive" ? "Employee disabled. They can no longer sign in." : "Employee enabled."
    if (data.profile_id) {
      // Also stop existing sessions from refreshing.
      const { error: banError } = await createAdminClient().auth.admin.updateUserById(data.profile_id, {
        ban_duration: status === "inactive" ? BLOCKED : "none",
      })
      if (banError) {
        logServerError("update sign-in block", banError)
        message =
          status === "inactive"
            ? "Employee disabled and their data access removed. Their sign-in could not be blocked; please try again."
            : "Employee enabled, but their sign-in could not be unblocked; please try again."
      }
    }

    revalidatePath("/admin/employees")
    revalidatePath(`/admin/employees/${id}`)
    return { ok: true, data: undefined, message }
  } catch (error) {
    return fail(error, "change employee status")
  }
}

/** Creates a login for the employee and emails them an invite to set a password. */
export async function grantPortalAccess(id: string): Promise<ActionResult> {
  try {
    const session = await authorizeAdmin()
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Employee not found." }

    const supabase = await createClient()
    const { data: employee, error } = await supabase
      .from("employees")
      .select("id, email, first_name, last_name, status, profile_id")
      .eq("id", id)
      .maybeSingle()
    if (error) return fail(error, "load employee")
    if (!employee) return { ok: false, error: "Employee not found." }
    if (employee.status !== "active") return { ok: false, error: "Enable the employee before giving them access." }
    if (employee.profile_id) return { ok: false, error: "This employee already has portal access." }

    const admin = createAdminClient()
    const fullName = `${employee.first_name} ${employee.last_name}`
    let profileId: string | null = null

    const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(employee.email, {
      redirectTo: inviteRedirect(),
      data: { full_name: fullName },
    })
    if (invited?.user) {
      profileId = invited.user.id
    } else if (inviteError?.code === "email_exists") {
      // A login with this email already exists (for example an admin-only account).
      // Admins can read profiles and employees under RLS, so no service role here.
      const { data: existing } = await supabase.from("profiles").select("id").eq("email", employee.email).maybeSingle()
      const { data: linked } = existing
        ? await supabase.from("employees").select("id").eq("profile_id", existing.id).maybeSingle()
        : { data: null }
      if (!existing || linked) return { ok: false, error: "Another employee already uses this login email." }
      profileId = existing.id
    } else {
      if (inviteError?.code === "over_email_send_rate_limit") {
        return { ok: false, error: "Too many emails sent recently. Please try again in a few minutes." }
      }
      return fail(inviteError, "invite employee")
    }

    const { error: linkError } = await admin.rpc("service_link_employee_profile", {
      p_employee_id: employee.id,
      p_profile_id: profileId,
      p_actor_id: session.userId,
    })
    if (linkError) return fail(linkError, "link employee login")

    await admin.rpc("service_log_event", {
      p_actor_id: session.userId,
      p_action: "employee.invite_sent",
      p_entity_type: "employee",
      p_entity_id: employee.id,
      p_subject_employee_id: employee.id,
      p_metadata: { name: fullName },
    })

    revalidatePath(`/admin/employees/${id}`)
    revalidatePath("/admin/employees")
    return {
      ok: true,
      data: undefined,
      message: invited?.user ? `Invite sent to ${employee.email}.` : "Portal access linked to the existing login.",
    }
  } catch (error) {
    return fail(error, "grant portal access")
  }
}

/** Emails the employee a link to set a new password (also works as a re-invite). */
export async function sendPasswordReset(id: string): Promise<ActionResult> {
  try {
    const session = await authorizeAdmin()
    if (!idSchema.safeParse(id).success) return { ok: false, error: "Employee not found." }

    const supabase = await createClient()
    const { data: employee } = await supabase
      .from("employees")
      .select("id, email, profile_id, status")
      .eq("id", id)
      .maybeSingle()
    if (!employee?.profile_id) return { ok: false, error: "This employee does not have portal access yet." }
    if (employee.status !== "active") return { ok: false, error: "Enable the employee first." }

    const { error } = await supabase.auth.resetPasswordForEmail(employee.email, { redirectTo: inviteRedirect() })
    if (error) {
      if (error.code === "over_email_send_rate_limit") {
        return { ok: false, error: "Too many emails sent recently. Please try again in a few minutes." }
      }
      return fail(error, "send password reset")
    }

    await createAdminClient().rpc("service_log_event", {
      p_actor_id: session.userId,
      p_action: "employee.password_reset_sent",
      p_entity_type: "employee",
      p_entity_id: employee.id,
      p_subject_employee_id: employee.id,
    })
    return { ok: true, data: undefined, message: `Password reset email sent to ${employee.email}.` }
  } catch (error) {
    return fail(error, "send password reset")
  }
}
