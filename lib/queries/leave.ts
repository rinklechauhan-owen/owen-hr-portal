import "server-only"

import { createClient } from "@/lib/supabase/server"

export type BalanceWithType = {
  id: string
  leave_type_id: string
  year: number
  allocated_days: number
  used_days: number
  remaining_days: number
  pending_days: number
  available_days: number
  leave_type: { name: string; requires_balance: boolean; sort_order: number; is_active: boolean } | null
}

/** Balances for one employee and year. RLS limits employees to their own. */
export async function getBalances(employeeId: string, year: number): Promise<BalanceWithType[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("leave_balance_summary")
    .select(
      "id, leave_type_id, year, allocated_days, used_days, remaining_days, pending_days, available_days, leave_type:leave_types(name, requires_balance, sort_order, is_active)"
    )
    .eq("employee_id", employeeId)
    .eq("year", year)
  if (error) throw error
  return ((data ?? []) as BalanceWithType[]).sort(
    (a, b) => (a.leave_type?.sort_order ?? 0) - (b.leave_type?.sort_order ?? 0)
  )
}

export const LEAVE_REQUEST_FIELDS =
  "id, start_date, end_date, total_days, reason, status, rejection_reason, cancellation_reason, reviewed_at, created_at, leave_type:leave_types(name)"

export type LeaveRequestRow = {
  id: string
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  rejection_reason: string | null
  cancellation_reason: string | null
  reviewed_at: string | null
  created_at: string
  leave_type: { name: string } | null
}
