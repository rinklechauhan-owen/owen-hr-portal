"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { authorizeEmployee } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { fail, invalid } from "@/lib/utils/errors"
import { formatDays } from "@/lib/utils/format"
import { type ApplyLeaveInput, applyLeaveSchema } from "@/lib/validations/leave"
import type { ActionResult } from "@/types/actions"

/**
 * Submits a leave request for the signed-in employee. The employee id comes from
 * the session, never from the browser. The database recalculates the working
 * days and checks the balance, overlaps and date rules before saving.
 */
export async function applyForLeave(input: ApplyLeaveInput): Promise<ActionResult<{ id: string }>> {
  try {
    const session = await authorizeEmployee()
    const parsed = applyLeaveSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("leave_requests")
      .insert({ ...parsed.data, employee_id: session.employee.id })
      .select("id, total_days")
      .single()
    if (error) return fail(error, "apply for leave")

    revalidatePath("/employee", "layout")
    return {
      ok: true,
      data: { id: data.id },
      message: `Leave request submitted for ${formatDays(data.total_days)}. HR will review it soon.`,
    }
  } catch (error) {
    return fail(error, "apply for leave")
  }
}

export async function cancelLeave(requestId: string): Promise<ActionResult> {
  try {
    await authorizeEmployee()
    if (!z.uuid().safeParse(requestId).success) return { ok: false, error: "Leave request not found." }

    const supabase = await createClient()
    const { error } = await supabase.rpc("cancel_leave_request", { p_request_id: requestId })
    if (error) return fail(error, "cancel leave")

    revalidatePath("/employee", "layout")
    return { ok: true, data: undefined, message: "Leave request cancelled." }
  } catch (error) {
    return fail(error, "cancel leave")
  }
}
