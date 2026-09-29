import { format, parseISO } from "date-fns"

export const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
] as const

/** "2026-09-30" -> "30 Sep 2026". Dates are calendar dates, never shifted by time zone. */
export function formatDate(isoDate: string, pattern = "d MMM yyyy") {
  return format(parseISO(isoDate.slice(0, 10)), pattern)
}

export function formatDateRange(start: string, end: string) {
  if (start === end) return formatDate(start)
  if (start.slice(0, 4) === end.slice(0, 4)) {
    return `${formatDate(start, "d MMM")} – ${formatDate(end)}`
  }
  return `${formatDate(start)} – ${formatDate(end)}`
}

/** Timestamps (created_at etc.) shown in the company's time zone. */
export function formatDateTime(timestamp: string, timeZone = "Asia/Kolkata") {
  return new Intl.DateTimeFormat("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(new Date(timestamp))
}

export function formatDays(days: number) {
  const value = Number(days)
  const text = Number.isInteger(value) ? String(value) : value.toFixed(1)
  return `${text} ${value === 1 ? "day" : "days"}`
}

export function monthName(month: number) {
  return MONTHS[month - 1] ?? ""
}

/** Payslip period label: "September 2026". */
export function payslipPeriod(year: number, month: number) {
  return `${monthName(month)} ${year}`
}

/** Financial year (April–March) label: 2026 -> "FY 2026-27". */
export function financialYearLabel(startYear: number) {
  return `FY ${startYear}-${String((startYear + 1) % 100).padStart(2, "0")}`
}

/** The financial year a date belongs to, as its starting year. */
export function financialYearOf(isoDate: string) {
  const year = Number(isoDate.slice(0, 4))
  const month = Number(isoDate.slice(5, 7))
  return month >= 4 ? year : year - 1
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

/** Today's date (YYYY-MM-DD) in a time zone. Servers run in UTC, the company in IST. */
export function todayIn(timeZone = "Asia/Kolkata", now = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now)
  return parts
}

export function greetingFor(timeZone = "Asia/Kolkata", now = new Date()) {
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", { timeZone, hour: "numeric", hour12: false }).format(now)
  )
  if (hour < 12) return "Good morning"
  if (hour < 17) return "Good afternoon"
  return "Good evening"
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")
}

/** Adds calendar days to a YYYY-MM-DD date. */
export function addDaysIso(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}
