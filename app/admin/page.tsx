import { CalendarCheck, CalendarClock, FileText, Inbox, PartyPopper, UserCheck, Users } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { ActivityList, type ActivityEntry } from "@/components/admin/activity-list"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { StatCard } from "@/components/shared/stat-card"
import { StatusBadge } from "@/components/shared/status-badge"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatDateRange, formatDays, todayIn } from "@/lib/utils/format"

export const metadata: Metadata = { title: "Dashboard" }

type Stats = {
  total_employees: number
  active_employees: number
  employees_without_access: number
  pending_requests: number
  approved_this_month: number
  on_leave_today: number
  upcoming_holidays: number
  payroll_documents: number
}

export default async function AdminDashboardPage() {
  const supabase = await createClient()
  const settings = await getSettings()
  const today = todayIn(settings.timezone)

  const [stats, pending, holidays, activity] = await Promise.all([
    supabase.rpc("get_admin_dashboard"),
    supabase
      .from("leave_requests")
      .select("id, start_date, end_date, total_days, created_at, employee:employees(first_name, last_name), leave_type:leave_types(name)")
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(5),
    supabase.from("holidays").select("id, name, holiday_date, is_optional").gte("holiday_date", today).order("holiday_date").limit(5),
    supabase
      .from("audit_logs")
      .select("id, action, metadata, created_at, actor:profiles(full_name, email)")
      .neq("action", "auth.signed_in")
      .order("created_at", { ascending: false })
      .limit(6),
  ])
  for (const result of [stats, pending, holidays, activity]) if (result.error) throw result.error
  const s = stats.data as unknown as Stats

  return (
    <>
      <PageHeader title="Dashboard" description={`${settings.company_name} HR overview · ${formatDate(today, "EEEE, d MMMM yyyy")}`} />

      <section aria-label="Key figures" className="grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4 xl:grid-cols-6">
        <StatCard label="Total employees" value={s.total_employees} icon={Users} href="/admin/employees?status=all" />
        <StatCard
          label="Active employees"
          value={s.active_employees}
          icon={UserCheck}
          href="/admin/employees"
          hint={s.employees_without_access ? `${s.employees_without_access} without portal access` : "All have portal access"}
        />
        <StatCard
          label="Pending leave"
          value={s.pending_requests}
          icon={Inbox}
          href="/admin/leave"
          tone={s.pending_requests > 0 ? "attention" : "default"}
          hint={s.pending_requests ? "Waiting for review" : "Nothing to review"}
        />
        <StatCard
          label="Approved this month"
          value={s.approved_this_month}
          icon={CalendarCheck}
          href="/admin/leave?status=approved"
          hint={`${s.on_leave_today} on leave today`}
        />
        <StatCard label="Upcoming holidays" value={s.upcoming_holidays} icon={PartyPopper} href="/admin/holidays" hint="Next 90 days" />
        <StatCard label="Payroll documents" value={s.payroll_documents} icon={FileText} href="/admin/payroll" />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-2">
        <section aria-labelledby="pending-heading">
          <SectionHeader
            title={<span id="pending-heading">Waiting for review</span>}
            action={<Link href="/admin/leave" className="text-sm font-medium text-brand hover:underline">View all</Link>}
          />
          {pending.data?.length ? (
            <ul className="divide-y rounded-xl border bg-card shadow-card">
              {pending.data.map((request) => (
                <li key={request.id}>
                  <Link href={`/admin/leave?status=pending`} className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-muted/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium">
                        {request.employee?.first_name} {request.employee?.last_name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {request.leave_type?.name} · {formatDateRange(request.start_date, request.end_date)}
                      </p>
                    </div>
                    <StatusBadge tone="warning">{formatDays(request.total_days)}</StatusBadge>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={Inbox} title="No pending requests" description="New leave requests will appear here." />
          )}
        </section>

        <section aria-labelledby="holidays-heading">
          <SectionHeader
            title={<span id="holidays-heading">Upcoming holidays</span>}
            action={<Link href="/admin/holidays" className="text-sm font-medium text-brand hover:underline">Manage</Link>}
          />
          {holidays.data?.length ? (
            <ul className="divide-y rounded-xl border bg-card shadow-card">
              {holidays.data.map((holiday) => (
                <li key={holiday.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="flex items-center gap-3">
                    <span className="flex size-10 flex-col items-center justify-center rounded-lg bg-secondary text-primary" aria-hidden>
                      <span className="text-[0.6rem] font-semibold uppercase">{formatDate(holiday.holiday_date, "MMM")}</span>
                      <span className="text-sm leading-none font-semibold">{formatDate(holiday.holiday_date, "d")}</span>
                    </span>
                    <div>
                      <p className="text-sm font-medium">{holiday.name}</p>
                      <p className="text-xs text-muted-foreground">{formatDate(holiday.holiday_date, "EEEE, d MMM yyyy")}</p>
                    </div>
                  </div>
                  {holiday.is_optional && <StatusBadge>Optional</StatusBadge>}
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={CalendarClock} title="No upcoming holidays" description="Add company holidays so employees can plan ahead." />
          )}
        </section>
      </div>

      <section aria-labelledby="activity-heading" className="mt-8">
        <SectionHeader
          title={<span id="activity-heading">Recent activity</span>}
          action={<Link href="/admin/audit-logs" className="text-sm font-medium text-brand hover:underline">Audit log</Link>}
        />
        {activity.data?.length ? (
          <ActivityList entries={activity.data as ActivityEntry[]} />
        ) : (
          <EmptyState compact title="No activity yet" description="Administrative actions will be listed here." />
        )}
      </section>
    </>
  )
}
