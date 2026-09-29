import { History } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { z } from "zod"

import { LeaveRequestCard } from "@/components/employee/leave-request-card"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterDropdown } from "@/components/shared/filter-dropdown"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { buttonVariants } from "@/components/ui/button"
import { requireEmployee } from "@/lib/permissions"
import { LEAVE_REQUEST_FIELDS, type LeaveRequestRow } from "@/lib/queries/leave"
import { createClient } from "@/lib/supabase/server"
import { flattenParams } from "@/lib/utils/params"
import { LEAVE_STATUSES } from "@/lib/validations/leave"

export const metadata: Metadata = { title: "Leave history" }

const PAGE_SIZE = 10

export default async function LeaveHistoryPage({ searchParams }: PageProps<"/employee/leave/history">) {
  const session = await requireEmployee()
  const params = flattenParams(await searchParams)
  const status = z.enum(LEAVE_STATUSES).safeParse(params.status).data
  const page = Math.max(1, Number(params.page) || 1)
  const { from, to } = pageRange(page, PAGE_SIZE)

  const supabase = await createClient()
  let query = supabase
    .from("leave_requests")
    .select(LEAVE_REQUEST_FIELDS, { count: "exact" })
    .eq("employee_id", session.employee.id)
    .order("start_date", { ascending: false })
    .range(from, to)
  if (status) query = query.eq("status", status)
  const { data, count, error } = await query
  if (error) throw error
  const requests = (data ?? []) as LeaveRequestRow[]

  return (
    <>
      <PageHeader
        title="Leave history"
        description="Every leave request you've made."
        backHref="/employee/leave"
        backLabel="Leave"
        actions={
          <FilterDropdown
            param="status"
            label="Status"
            allLabel="All requests"
            options={LEAVE_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
          />
        }
      />
      {requests.length ? (
        <>
          <div className="grid gap-3 md:grid-cols-2">
            {requests.map((request) => (
              <LeaveRequestCard key={request.id} request={request} />
            ))}
          </div>
          <Pagination basePath="/employee/leave/history" params={params} page={page} total={count ?? 0} pageSize={PAGE_SIZE} />
        </>
      ) : (
        <EmptyState
          icon={History}
          title={status ? `No ${status} requests` : "No Leave Requests"}
          description={status ? "Try another status." : "You haven't submitted any leave requests yet."}
          action={
            !status && (
              <Link href="/employee/leave/apply" className={buttonVariants({ size: "lg" })}>
                Apply for Leave
              </Link>
            )
          }
        />
      )}
    </>
  )
}
