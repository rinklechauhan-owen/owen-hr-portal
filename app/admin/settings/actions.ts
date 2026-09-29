"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { publicEnv } from "@/lib/env"
import { authorizeAdmin } from "@/lib/permissions"
import { createAdminClient } from "@/lib/supabase/admin"
import { createClient } from "@/lib/supabase/server"
import { fail, invalid } from "@/lib/utils/errors"
import { leaveTypeSchema } from "@/lib/validations/leave"
import { companySettingsSchema, departmentSchema, inviteAdminSchema } from "@/lib/validations/settings"
import type { ActionResult } from "@/types/actions"

const id = z.uuid()

function refresh() {
  revalidatePath("/admin", "layout")
  revalidatePath("/employee", "layout")
}

export async function saveCompanySettings(input: z.input<typeof companySettingsSchema>): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    const parsed = companySettingsSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)
    const supabase = await createClient()
    const { error } = await supabase
      .from("app_settings")
      .update({ ...parsed.data, weekend_days: [...parsed.data.weekend_days].sort() })
      .eq("id", true)
    if (error) return fail(error, "save settings")
    refresh()
    return { ok: true, data: undefined, message: "Settings saved." }
  } catch (error) {
    return fail(error, "save settings")
  }
}

export async function saveLeaveType(typeId: string | null, input: z.input<typeof leaveTypeSchema>): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    if (typeId && !id.safeParse(typeId).success) return { ok: false, error: "Leave type not found." }
    const parsed = leaveTypeSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)
    const row = { ...parsed.data, description: parsed.data.description || null }

    const supabase = await createClient()
    const { error } = typeId
      ? await supabase.from("leave_types").update(row).eq("id", typeId)
      : await supabase.from("leave_types").insert(row)
    if (error) return fail(error, "save leave type")
    refresh()
    return { ok: true, data: undefined, message: typeId ? "Leave type updated." : "Leave type added." }
  } catch (error) {
    return fail(error, "save leave type")
  }
}

export async function allocateLeave(year: number): Promise<ActionResult<number>> {
  try {
    await authorizeAdmin()
    const supabase = await createClient()
    const { data, error } = await supabase.rpc("allocate_leave_for_year", { p_year: year })
    if (error) return fail(error, "allocate leave")
    refresh()
    return {
      ok: true,
      data,
      message: data ? `Created ${data} leave balance${data === 1 ? "" : "s"} for ${year}.` : `Everyone already has ${year} balances.`,
    }
  } catch (error) {
    return fail(error, "allocate leave")
  }
}

export async function saveDepartment(departmentId: string | null, input: z.input<typeof departmentSchema>): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    if (departmentId && !id.safeParse(departmentId).success) return { ok: false, error: "Department not found." }
    const parsed = departmentSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)
    const supabase = await createClient()
    const { error } = departmentId
      ? await supabase.from("departments").update(parsed.data).eq("id", departmentId)
      : await supabase.from("departments").insert(parsed.data)
    if (error) return fail(error, "save department")
    refresh()
    return { ok: true, data: undefined, message: departmentId ? "Department renamed." : "Department added." }
  } catch (error) {
    return fail(error, "save department")
  }
}

export async function deleteDepartment(departmentId: string): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    if (!id.safeParse(departmentId).success) return { ok: false, error: "Department not found." }
    const supabase = await createClient()
    const { error } = await supabase.from("departments").delete().eq("id", departmentId)
    if (error) {
      if (error.code === "23503") return { ok: false, error: "Move its employees to another department before deleting it." }
      return fail(error, "delete department")
    }
    refresh()
    return { ok: true, data: undefined, message: "Department deleted." }
  } catch (error) {
    return fail(error, "delete department")
  }
}

/** Gives or removes admin rights for an existing login. You cannot change your own. */
export async function setAdminRole(profileId: string, role: "admin" | "employee"): Promise<ActionResult> {
  try {
    const session = await authorizeAdmin()
    if (!id.safeParse(profileId).success || !["admin", "employee"].includes(role)) {
      return { ok: false, error: "User not found." }
    }
    if (profileId === session.userId) return { ok: false, error: "You cannot change your own role." }

    const supabase = await createClient()
    if (role === "employee") {
      // An admin-only login (no employee record) would be left with no portal at all.
      const { data: employee } = await supabase.from("employees").select("id").eq("profile_id", profileId).maybeSingle()
      if (!employee) return { ok: false, error: "This admin has no employee record. Disable their access instead." }
    }

    const { data, error } = await supabase.from("profiles").update({ role }).eq("id", profileId).select("full_name, email").maybeSingle()
    if (error) return fail(error, "change role")
    if (!data) return { ok: false, error: "User not found." }

    await createAdminClient().rpc("service_log_event", {
      p_actor_id: session.userId,
      p_action: "admin.role_changed",
      p_entity_type: "profile",
      p_entity_id: profileId,
      p_metadata: { name: data.full_name || data.email, role },
    })
    refresh()
    return { ok: true, data: undefined, message: role === "admin" ? "Admin access granted." : "Admin access removed." }
  } catch (error) {
    return fail(error, "change role")
  }
}

/** Invites someone who is not an employee (e.g. an HR consultant) as an admin. */
export async function inviteAdmin(input: z.input<typeof inviteAdminSchema>): Promise<ActionResult> {
  try {
    const session = await authorizeAdmin()
    const parsed = inviteAdminSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    // Employees become admins through "Make an employee admin", never by invite:
    // inviting an existing pending login would otherwise promote it silently.
    const supabase = await createClient()
    const [{ data: employee }, { data: profile }] = await Promise.all([
      supabase.from("employees").select("id").eq("email", parsed.data.email).maybeSingle(),
      supabase.from("profiles").select("id").eq("email", parsed.data.email).maybeSingle(),
    ])
    if (employee) return { ok: false, error: "This email belongs to an employee. Use “Make an employee admin” instead." }
    if (profile) return { ok: false, error: "This person already has a login. Give them admin access from the list below." }

    const admin = createAdminClient()
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, {
      redirectTo: `${publicEnv().NEXT_PUBLIC_SITE_URL}/auth/confirm?next=/reset-password`,
      data: { full_name: parsed.data.full_name },
    })
    if (error || !data.user) {
      if (error?.code === "email_exists") {
        return { ok: false, error: "This person already has a login. Give them admin access from the list below." }
      }
      return fail(error, "invite admin")
    }

    // Set the role with the inviting admin's own session, so RLS and the role guard apply.
    const { error: roleError } = await supabase.from("profiles").update({ role: "admin" }).eq("id", data.user.id)
    if (roleError) return fail(roleError, "set admin role")

    await admin.rpc("service_log_event", {
      p_actor_id: session.userId,
      p_action: "admin.invited",
      p_entity_type: "profile",
      p_entity_id: data.user.id,
      p_metadata: { name: parsed.data.full_name },
    })
    refresh()
    return { ok: true, data: undefined, message: `Invite sent to ${parsed.data.email}.` }
  } catch (error) {
    return fail(error, "invite admin")
  }
}

export async function promoteEmployeeToAdmin(employeeId: string): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    if (!id.safeParse(employeeId).success) return { ok: false, error: "Choose an employee." }
    const supabase = await createClient()
    const { data: employee } = await supabase
      .from("employees")
      .select("profile_id, status")
      .eq("id", employeeId)
      .maybeSingle()
    if (!employee) return { ok: false, error: "Employee not found." }
    if (employee.status !== "active") return { ok: false, error: "Enable the employee first." }
    if (!employee.profile_id) return { ok: false, error: "Give this employee portal access first, then make them an admin." }
    return setAdminRole(employee.profile_id, "admin")
  } catch (error) {
    return fail(error, "promote employee")
  }
}
