import { addMonths, format, parseISO } from "date-fns"
import { CalendarPlus, ChevronLeft, ChevronRight, PartyPopper } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { CalendarLegend, type CalendarLeave, MonthCalendar } from "@/components/employee/month-calendar"
import { EmptyState } from "@/components/shared/empty-state"
import { HolidayCard } from "@/components/shared/holiday-card"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { LeaveStatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireEmployee } from "@/lib/permissions"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDateRange, formatDays, todayIn } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Calendar" }

export default async function CalendarPage({ searchParams }: PageProps<"/employee/calendar">) {
  const session = await requireEmployee()
  const params = flattenParams(await searchParams)
  const settings = await getSettings()
  const today = todayIn(settings.timezone)
  const month = /^\d{4}-(0[1-9]|1[0-2])$/.test(params.month ?? "") ? `${params.month}-01` : `${today.slice(0, 7)}-01`
  const monthStart = parseISO(month)
  const first = format(monthStart, "yyyy-MM-dd")
  const last = format(addMonths(monthStart, 1), "yyyy-MM-dd")

  const supabase = await createClient()
  const [leave, holidays] = await Promise.all([
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, status, total_days, leave_type:leave_types(name)")
      .eq("employee_id", session.employee.id)
      .in("status", ["pending", "approved"])
      .lt("start_date", last)
      .gte("end_date", first)
      .order("start_date"),
    supabase
      .from("holidays")
      .select("id, name, holiday_date, description, is_optional")
      .gte("holiday_date", first)
      .lt("holiday_date", last)
      .order("holiday_date"),
  ])
  if (leave.error) throw leave.error
  if (holidays.error) throw holidays.error

  const leaveItems = (leave.data ?? []).map((l) => ({
    id: l.id,
    start_date: l.start_date,
    end_date: l.end_date,
    status: l.status as CalendarLeave["status"],
    total_days: l.total_days,
    leave_type: l.leave_type?.name ?? "Leave",
  }))
  const monthHref = (offset: number) => `/employee/calendar?month=${format(addMonths(monthStart, offset), "yyyy-MM")}`

  return (
    <>
      <PageHeader
        title="Calendar"
        description="Your leave and company holidays."
        actions={
          <Link href="/employee/leave/apply" className={buttonVariants({ variant: "outline" })}>
            <CalendarPlus aria-hidden />
            Apply for leave
          </Link>
        }
      />

      <div className="mb-3 flex items-center justify-between gap-3">
        <nav aria-label="Month" className="flex items-center gap-1">
          <Link href={monthHref(-1)} scroll={false} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Previous month">
            <ChevronLeft aria-hidden />
          </Link>
          <Link href={monthHref(1)} scroll={false} className={buttonVariants({ variant: "outline", size: "icon" })} aria-label="Next month">
            <ChevronRight aria-hidden />
          </Link>
          {month.slice(0, 7) !== today.slice(0, 7) && (
            <Link href="/employee/calendar" scroll={false} className={buttonVariants({ variant: "ghost" })}>
              Today
            </Link>
          )}
        </nav>
        <h2 className="text-lg font-semibold" aria-live="polite">
          {format(monthStart, "MMMM yyyy")}
        </h2>
      </div>

      <MonthCalendar month={month} today={today} leave={leaveItems} holidays={holidays.data ?? []} weekendDays={settings.weekend_days} />
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
        <CalendarLegend />
        <Link href="/employee/holidays" className="text-sm font-medium text-brand hover:underline">
          All holidays
        </Link>
      </div>

      <section aria-labelledby="month-heading" className="mt-8 space-y-3">
        <SectionHeader title={<span id="month-heading">This month</span>} />
        {leaveItems.length === 0 && (holidays.data ?? []).length === 0 && (
          <EmptyState compact icon={PartyPopper} title="Nothing planned" description="No leave or holidays this month." />
        )}
        {leaveItems.map((l) => (
          <div key={l.id} className="flex items-center justify-between gap-3 rounded-xl border bg-card p-4 shadow-card">
            <div>
              <p className="font-medium">{l.leave_type}</p>
              <p className="text-sm text-muted-foreground">
                {formatDateRange(l.start_date, l.end_date)} · {formatDays(l.total_days)}
              </p>
            </div>
            <LeaveStatusBadge status={l.status} />
          </div>
        ))}
        {(holidays.data ?? []).map((h) => (
          <HolidayCard key={h.id} holiday={h} past={h.holiday_date < today} />
        ))}
      </section>
    </>
  )
}
