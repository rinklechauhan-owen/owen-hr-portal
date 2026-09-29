import { formatDate } from "@/lib/utils/format"
import type { Json } from "@/types/database"

const ACTION_LABELS: Record<string, string> = {
  "auth.signed_in": "Signed in",
  "employee.created": "Employee created",
  "employee.updated": "Employee updated",
  "employee.disabled": "Employee disabled",
  "employee.enabled": "Employee enabled",
  "employee.access_granted": "Portal access granted",
  "employee.invite_sent": "Invite sent",
  "employee.password_reset_sent": "Password reset sent",
  "leave.submitted": "Leave requested",
  "leave.cancelled": "Leave cancelled",
  "leave.approved": "Leave approved",
  "leave.rejected": "Leave rejected",
  "leave.revoked": "Leave revoked",
  "leave_balance.created": "Leave balance added",
  "leave_balance.updated": "Leave balance updated",
  "leave_balance.deleted": "Leave balance removed",
  "leave_balance.bulk_allocated": "Leave allocated for the year",
  "leave_type.created": "Leave type created",
  "leave_type.updated": "Leave type updated",
  "leave_type.deleted": "Leave type deleted",
  "holiday.created": "Holiday created",
  "holiday.updated": "Holiday updated",
  "holiday.deleted": "Holiday deleted",
  "department.created": "Department created",
  "department.updated": "Department updated",
  "department.deleted": "Department deleted",
  "payslip.uploaded": "Payslip uploaded",
  "payslip.replaced": "Payslip replaced",
  "payslip.deleted": "Payslip deleted",
  "ytd_report.uploaded": "YTD report uploaded",
  "ytd_report.replaced": "YTD report replaced",
  "ytd_report.deleted": "YTD report deleted",
  "pf_ytd_report.uploaded": "PF report uploaded",
  "pf_ytd_report.replaced": "PF report replaced",
  "pf_ytd_report.deleted": "PF report deleted",
  "settings.updated": "Settings updated",
  "admin.invited": "Admin invited",
  "admin.role_changed": "Admin access changed",
}

/** Filter options for the audit log, grouped by area. */
export const AUDIT_ACTION_GROUPS = [
  { value: "employee", label: "Employees" },
  { value: "leave", label: "Leave requests" },
  { value: "leave_balance", label: "Leave balances" },
  { value: "holiday", label: "Holidays" },
  { value: "payslip", label: "Payslips" },
  { value: "ytd_report", label: "YTD reports" },
  { value: "pf_ytd_report", label: "PF reports" },
  { value: "auth", label: "Sign-ins" },
  { value: "settings", label: "Settings" },
] as const

export function actionLabel(action: string) {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ").replace(/^\w/, (c) => c.toUpperCase())
}

export type AuditTone = "neutral" | "success" | "danger" | "warning" | "info"

export function actionTone(action: string): AuditTone {
  if (/\.(approved|enabled|access_granted|uploaded)$/.test(action)) return "success"
  if (/\.(rejected|disabled|revoked|deleted)$/.test(action)) return "danger"
  if (/\.(submitted)$/.test(action)) return "warning"
  if (action === "auth.signed_in") return "neutral"
  return "info"
}

const FIELD_LABELS: Record<string, string> = {
  first_name: "first name",
  last_name: "last name",
  employee_code: "employee ID",
  department_id: "department",
  joining_date: "joining date",
  allocated_days: "allocation",
  holiday_date: "date",
  is_optional: "optional flag",
  default_days: "default days",
  requires_balance: "balance setting",
  is_active: "active flag",
  weekend_days: "weekend days",
  max_backdate_days: "backdating limit",
  max_advance_days: "advance limit",
  company_name: "company name",
}

/** One-line, non-sensitive description of an audit entry's details. */
export function describeAuditMetadata(action: string, metadata: Json): string | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null
  const m = metadata as Record<string, Json | undefined>
  const text = (value: Json | undefined) => (typeof value === "string" || typeof value === "number" ? String(value) : "")

  if (action.startsWith("leave.")) {
    const parts = [text(m.leave_type)]
    if (typeof m.start_date === "string" && typeof m.end_date === "string") {
      parts.push(m.start_date === m.end_date ? formatDate(m.start_date) : `${formatDate(m.start_date)} – ${formatDate(m.end_date)}`)
    }
    return parts.filter(Boolean).join(" · ") || null
  }
  if (action.startsWith("employee.")) {
    const who = [text(m.name), text(m.employee_code)].filter(Boolean).join(" · ")
    if (Array.isArray(m.changed_fields) && m.changed_fields.length) {
      const fields = m.changed_fields.map((f) => FIELD_LABELS[String(f)] ?? String(f).replace(/_/g, " "))
      return `${who}${who ? " — " : ""}changed ${fields.join(", ")}`
    }
    return who || null
  }
  if (action.startsWith("leave_balance.")) {
    if (action === "leave_balance.bulk_allocated") return `${text(m.created)} balance(s) for ${text(m.year)}`
    const base = [text(m.leave_type), text(m.year)].filter(Boolean).join(" ")
    if (m.previous_allocated_days !== undefined) {
      return `${base}: ${text(m.previous_allocated_days)} → ${text(m.allocated_days)} days`
    }
    return m.allocated_days !== undefined ? `${base}: ${text(m.allocated_days)} days` : base || null
  }
  if (action.startsWith("holiday.")) {
    return [text(m.name), typeof m.date === "string" ? formatDate(m.date) : ""].filter(Boolean).join(" · ") || null
  }
  if (/^(payslip|ytd_report|pf_ytd_report)\./.test(action)) {
    return text(m.period) || null
  }
  if (Array.isArray(m.changed_fields) && m.changed_fields.length) {
    return `Changed ${m.changed_fields.map((f) => FIELD_LABELS[String(f)] ?? String(f).replace(/_/g, " ")).join(", ")}`
  }
  return text(m.name) || null
}
