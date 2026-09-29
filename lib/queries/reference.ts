import "server-only"

import { cache } from "react"

import { createClient } from "@/lib/supabase/server"

// Small reference lists used by forms and filters, loaded once per request.

export const getDepartments = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.from("departments").select("id, name").order("name")
  if (error) throw error
  return data
})

export const getLeaveTypes = cache(async (options: { activeOnly?: boolean } = {}) => {
  const supabase = await createClient()
  let query = supabase
    .from("leave_types")
    .select("id, name, description, default_days, requires_balance, is_active, sort_order")
    .order("sort_order")
    .order("name")
  if (options.activeOnly) query = query.eq("is_active", true)
  const { data, error } = await query
  if (error) throw error
  return data
})

export const getSettings = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.from("app_settings").select("*").single()
  if (error) throw error
  return data
})
