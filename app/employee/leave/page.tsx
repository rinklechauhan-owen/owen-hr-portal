import { CalendarPlus, CalendarRange, History } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { LeaveBalanceCard } from "@/components/employee/leave-balance-card"
import { LeaveRequestCard } from "@/components/employee/leave-request-card"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { requireEmployee } from "@/lib/permissions"
import { getBalances, LEAVE_REQUEST_FIELDS, type LeaveRequestRow } from "@/lib/queries/leave"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { todayIn } from "@/lib/utils/format"

export const metadata: Metadata = { title: "Leave" }

export default async function EmployeeLeavePage() {
  const session = await requireEmployee()
  const settings = await getSettings()
  const year = Number(todayIn(settings.timezone).slice(0, 4))
  const supabase = await createClient()

  const [balances, { data: requests, error }] = await Promise.all([
    getBalances(session.employee.id, year),
    supabase
      .from("leave_requests")
      .select(LEAVE_REQUEST_FIELDS)
      .eq("employee_id", session.employee.id)
      .order("created_at", { ascending: false })
      .limit(5),
  ])
  if (error) throw error
  const recent = (requests ?? []) as LeaveRequestRow[]

  return (
    <>
      <PageHeader
        title="Leave"
        description={`Your balances for ${year} and recent requests.`}
        actions={
          <Link href="/employee/leave/apply" className={buttonVariants({ size: "lg", className: "w-full sm:w-auto" })}>
            <CalendarPlus aria-hidden />
            Apply for leave
          </Link>
        }
      />

      <section aria-labelledby="balances-heading">
        <SectionHeader title={<span id="balances-heading">Leave balance</span>} />
        {balances.length ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {balances.map((balance) => (
              <LeaveBalanceCard key={balance.id} balance={balance} />
            ))}
          </div>
        ) : (
          <EmptyState
            compact
            icon={CalendarRange}
            title="No leave balance yet"
            description={`HR hasn't allocated your ${year} leave yet. Please contact HR if you think this is a mistake.`}
          />
        )}
      </section>

      <section aria-labelledby="recent-heading" className="mt-8">
        <SectionHeader
          title={<span id="recent-heading">Recent requests</span>}
          action={
            recent.length > 0 && (
              <Link href="/employee/leave/history" className="text-sm font-medium text-brand hover:underline">
                View history
              </Link>
            )
          }
        />
        {recent.length ? (
          <div className="grid gap-3 md:grid-cols-2">
            {recent.map((request) => (
              <LeaveRequestCard key={request.id} request={request} />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={History}
            title="No Leave Requests"
            description="You haven't submitted any leave requests yet."
            action={
              <Link href="/employee/leave/apply" className={buttonVariants({ size: "lg" })}>
                Apply for Leave
              </Link>
            }
          />
        )}
      </section>
    </>
  )
}
