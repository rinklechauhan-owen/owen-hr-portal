"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { authorizeAdmin } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { fail, invalid } from "@/lib/utils/errors"
import { balanceSchema, createBalanceSchema, reviewLeaveSchema, revokeLeaveSchema } from "@/lib/validations/leave"
import type { ActionResult } from "@/types/actions"

function refresh() {
  revalidatePath("/admin", "layout")
}

/**
 * Approve or reject. The database function checks the reviewer is an admin, the
 * request is still pending, it is not their own, and on approval deducts the
 * balance in the same transaction.
 */
export async function reviewLeave(input: z.input<typeof reviewLeaveSchema>): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    const parsed = reviewLeaveSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    const supabase = await createClient()
    const { error } = await supabase.rpc("review_leave_request", {
      p_request_id: parsed.data.request_id,
      p_decision: parsed.data.decision,
      p_rejection_reason: parsed.data.decision === "rejected" ? parsed.data.rejection_reason : null,
    })
    if (error) return fail(error, "review leave")

    refresh()
    return {
      ok: true,
      data: undefined,
      message: parsed.data.decision === "approved" ? "Leave approved. The balance has been updated." : "Leave rejected.",
    }
  } catch (error) {
    return fail(error, "review leave")
  }
}

export async function revokeLeave(input: z.input<typeof revokeLeaveSchema>): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    const parsed = revokeLeaveSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    const supabase = await createClient()
    const { error } = await supabase.rpc("revoke_leave_request", {
      p_request_id: parsed.data.request_id,
      p_reason: parsed.data.reason,
    })
    if (error) return fail(error, "revoke leave")

    refresh()
    return { ok: true, data: undefined, message: "Leave revoked. The days have been returned to the balance." }
  } catch (error) {
    return fail(error, "revoke leave")
  }
}

export async function updateBalance(input: z.input<typeof balanceSchema>): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    const parsed = balanceSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    const supabase = await createClient()
    const { data, error } = await supabase
      .from("leave_balances")
      .update({ allocated_days: parsed.data.allocated_days })
      .eq("id", parsed.data.balance_id)
      .select("employee_id")
      .maybeSingle()
    if (error) return fail(error, "update balance")
    if (!data) return { ok: false, error: "Balance not found." }

    revalidatePath(`/admin/employees/${data.employee_id}`)
    return { ok: true, data: undefined, message: "Allocation updated." }
  } catch (error) {
    return fail(error, "update balance")
  }
}

export async function createBalance(input: z.input<typeof createBalanceSchema>): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    const parsed = createBalanceSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    const supabase = await createClient()
    const { error } = await supabase.from("leave_balances").insert(parsed.data)
    if (error) return fail(error, "create balance")

    revalidatePath(`/admin/employees/${parsed.data.employee_id}`)
    return { ok: true, data: undefined, message: "Balance added." }
  } catch (error) {
    return fail(error, "create balance")
  }
}
