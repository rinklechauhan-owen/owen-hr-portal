import { CalendarDays, CalendarPlus, ChevronRight, FileText, History, PartyPopper } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { LeaveBalanceCard } from "@/components/employee/leave-balance-card"
import { EmptyState } from "@/components/shared/empty-state"
import { HolidayCard } from "@/components/shared/holiday-card"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { LeaveStatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { requireEmployee } from "@/lib/permissions"
import { getBalances, LEAVE_REQUEST_FIELDS, type LeaveRequestRow } from "@/lib/queries/leave"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatDateRange, formatDays, greetingFor, todayIn } from "@/lib/utils/format"

export const metadata: Metadata = { title: "Dashboard" }

const QUICK_ACTIONS = [
  { href: "/employee/leave/apply", label: "Apply Leave", icon: CalendarPlus },
  { href: "/employee/calendar", label: "View Calendar", icon: CalendarDays },
  { href: "/employee/salary/payslips", label: "View Payslips", icon: FileText },
]

export default async function EmployeeDashboardPage() {
  const session = await requireEmployee()
  const settings = await getSettings()
  const today = todayIn(settings.timezone)
  const year = Number(today.slice(0, 4))
  const supabase = await createClient()

  const [balances, holidays, requests] = await Promise.all([
    getBalances(session.employee.id, year),
    supabase.from("holidays").select("id, name, holiday_date, description, is_optional").gte("holiday_date", today).order("holiday_date").limit(3),
    supabase
      .from("leave_requests")
      .select(LEAVE_REQUEST_FIELDS)
      .eq("employee_id", session.employee.id)
      .order("created_at", { ascending: false })
      .limit(4),
  ])
  if (holidays.error) throw holidays.error
  if (requests.error) throw requests.error
  const recent = (requests.data ?? []) as LeaveRequestRow[]
  const trackedBalances = balances.filter((b) => b.leave_type?.requires_balance)

  return (
    <>
      <PageHeader
        title={`${greetingFor(settings.timezone)}, ${session.employee.first_name}`}
        description={formatDate(today, "EEEE, d MMMM yyyy")}
      />

      <section aria-labelledby="balance-heading">
        <SectionHeader
          title={<span id="balance-heading">Leave Balance</span>}
          action={<Link href="/employee/leave" className="text-sm font-medium text-brand hover:underline">Details</Link>}
        />
        {trackedBalances.length ? (
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
            {trackedBalances.map((balance) => (
              <div key={balance.id} className="w-[72%] shrink-0 snap-start sm:w-auto">
                <LeaveBalanceCard balance={balance} compact />
              </div>
            ))}
          </div>
        ) : (
          <EmptyState compact title="No leave balance yet" description={`HR hasn't allocated your ${year} leave yet.`} />
        )}
      </section>

      <section aria-labelledby="actions-heading" className="mt-8">
        <SectionHeader title={<span id="actions-heading">Quick Actions</span>} />
        <ul className="grid grid-cols-3 gap-3">
          {QUICK_ACTIONS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex h-full flex-col items-center justify-center gap-2 rounded-xl border bg-card px-2 py-4 text-center text-sm font-medium shadow-card transition-colors hover:border-brand/40 sm:flex-row sm:justify-start sm:px-4 sm:text-left"
              >
                <span className="flex size-10 items-center justify-center rounded-full bg-secondary text-primary" aria-hidden>
                  <Icon className="size-5" />
                </span>
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="holidays-heading">
          <SectionHeader
            title={<span id="holidays-heading">Upcoming Holidays</span>}
            action={<Link href="/employee/holidays" className="text-sm font-medium text-brand hover:underline">All holidays</Link>}
          />
          {holidays.data?.length ? (
            <div className="space-y-2.5">
              {holidays.data.map((holiday) => (
                <HolidayCard key={holiday.id} holiday={holiday} />
              ))}
            </div>
          ) : (
            <EmptyState compact icon={PartyPopper} title="No upcoming holidays" description="HR will publish holidays here." />
          )}
        </section>

        <section aria-labelledby="requests-heading">
          <SectionHeader
            title={<span id="requests-heading">Recent Leave Requests</span>}
            action={
              recent.length > 0 && (
                <Link href="/employee/leave/history" className="text-sm font-medium text-brand hover:underline">View all</Link>
              )
            }
          />
          {recent.length ? (
            <ul className="divide-y rounded-xl border bg-card shadow-card">
              {recent.map((request) => (
                <li key={request.id}>
                  <Link href="/employee/leave/history" className="flex items-center gap-3 px-4 py-3 hover:bg-muted/50">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{request.leave_type?.name}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {formatDateRange(request.start_date, request.end_date)} · {formatDays(request.total_days)}
                      </p>
                    </div>
                    <LeaveStatusBadge status={request.status} />
                    <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState
              compact
              icon={History}
              title="No Leave Requests"
              description="You haven't submitted any leave requests yet."
              action={<Link href="/employee/leave/apply" className={buttonVariants()}>Apply for Leave</Link>}
            />
          )}
        </section>
      </div>
    </>
  )
}
