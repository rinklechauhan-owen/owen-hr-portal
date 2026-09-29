import "server-only"

import type { z } from "zod"

import { ActionError } from "@/lib/permissions"
import type { FieldErrors } from "@/types/actions"

type DatabaseError = { code?: string; message?: string }

// Friendly wording for constraint violations users can actually cause.
const CONSTRAINT_MESSAGES: Record<string, string> = {
  employees_email_key: "An employee with this email already exists.",
  employees_employee_code_key: "This employee ID is already in use.",
  departments_name_key: "A department with this name already exists.",
  leave_types_name_key: "A leave type with this name already exists.",
  holidays_holiday_date_name_key: "This holiday already exists on that date.",
  leave_balances_employee_id_leave_type_id_year_key: "A balance for this leave type and year already exists.",
  payslips_employee_id_year_month_key: "A payslip for this month has already been uploaded.",
  ytd_reports_employee_id_year_key: "A YTD report for this year has already been uploaded.",
  pf_ytd_reports_employee_id_year_key: "A PF YTD report for this year has already been uploaded.",
  leave_requests_no_overlap: "You already have a leave request that overlaps these dates.",
}

const GENERIC = "Something went wrong. Please try again."

/**
 * Turns a database or auth error into a message safe to show users. Messages the
 * database raises on purpose (SQLSTATE P0001) are shown as written; anything else
 * is replaced with plain wording so no technical detail leaks.
 */
export function toUserMessage(error: unknown, context = "action"): string {
  if (error instanceof ActionError) return error.message

  const dbError = error as DatabaseError | null
  const code = dbError?.code
  const message = dbError?.message ?? ""

  if (code === "P0001" && message) return message

  const constraint = Object.keys(CONSTRAINT_MESSAGES).find((name) => message.includes(name))
  if (constraint) return CONSTRAINT_MESSAGES[constraint]

  if (code === "23505") return "A record with these details already exists."
  if (code === "23503") return "This record is in use elsewhere and cannot be changed or removed."
  if (code === "23514" || code === "22P02" || code === "22007") return "Some of the details are not valid. Please check and try again."
  if (code === "42501" || message.includes("row-level security")) return "You don't have permission to do that."

  logServerError(context, error)
  return GENERIC
}

/** Logs an unexpected error with its code only: no row data, tokens or personal details. */
export function logServerError(context: string, error: unknown) {
  const dbError = error as DatabaseError | null
  console.error(`[owen-hr] ${context} failed`, {
    code: dbError?.code ?? "unknown",
    name: error instanceof Error ? error.name : typeof error,
  })
}

export function fail(error: unknown, context?: string): { ok: false; error: string } {
  return { ok: false, error: toUserMessage(error, context) }
}

/** Standard failure for input that did not pass server-side validation. */
export function invalid(error: z.ZodError): { ok: false; error: string; fieldErrors: FieldErrors } {
  const fieldErrors: FieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path.join(".") || "form"
    fieldErrors[key] = [...(fieldErrors[key] ?? []), issue.message]
  }
  return { ok: false, error: error.issues[0]?.message ?? "Please check the form and try again.", fieldErrors }
}
