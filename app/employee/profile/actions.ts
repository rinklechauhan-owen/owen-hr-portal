"use server"

import { revalidatePath } from "next/cache"

import { authorizeEmployee } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { fail, invalid } from "@/lib/utils/errors"
import { phoneSchema } from "@/lib/validations/employee"
import type { ActionResult } from "@/types/actions"

/**
 * Phone is the only field employees can change. It goes through a database
 * function that updates just that column on the caller's own record.
 */
export async function updateMyPhone(input: { phone: string }): Promise<ActionResult> {
  try {
    await authorizeEmployee()
    const parsed = phoneSchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)

    const supabase = await createClient()
    const { error } = await supabase.rpc("update_my_phone", { p_phone: parsed.data.phone || null })
    if (error) return fail(error, "update phone")

    revalidatePath("/employee/profile")
    return { ok: true, data: undefined, message: "Phone number updated." }
  } catch (error) {
    return fail(error, "update phone")
  }
}
