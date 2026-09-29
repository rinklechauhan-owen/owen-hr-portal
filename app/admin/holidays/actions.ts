"use server"

import { revalidatePath } from "next/cache"
import { z } from "zod"

import { authorizeAdmin } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { fail, invalid } from "@/lib/utils/errors"
import { type HolidayInput, holidaySchema } from "@/lib/validations/holiday"
import type { ActionResult } from "@/types/actions"

function refresh() {
  revalidatePath("/admin/holidays")
  revalidatePath("/admin")
  revalidatePath("/employee", "layout")
}

export async function saveHoliday(holidayId: string | null, input: HolidayInput): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    if (holidayId && !z.uuid().safeParse(holidayId).success) return { ok: false, error: "Holiday not found." }
    const parsed = holidaySchema.safeParse(input)
    if (!parsed.success) return invalid(parsed.error)
    const row = { ...parsed.data, description: parsed.data.description || null }

    const supabase = await createClient()
    const { error } = holidayId
      ? await supabase.from("holidays").update(row).eq("id", holidayId)
      : await supabase.from("holidays").insert(row)
    if (error) return fail(error, "save holiday")

    refresh()
    return {
      ok: true,
      data: undefined,
      message: holidayId ? "Holiday updated." : "Holiday added. Employees have been notified.",
    }
  } catch (error) {
    return fail(error, "save holiday")
  }
}

export async function deleteHoliday(holidayId: string): Promise<ActionResult> {
  try {
    await authorizeAdmin()
    if (!z.uuid().safeParse(holidayId).success) return { ok: false, error: "Holiday not found." }
    const supabase = await createClient()
    const { error } = await supabase.from("holidays").delete().eq("id", holidayId)
    if (error) return fail(error, "delete holiday")
    refresh()
    return { ok: true, data: undefined, message: "Holiday deleted." }
  } catch (error) {
    return fail(error, "delete holiday")
  }
}
