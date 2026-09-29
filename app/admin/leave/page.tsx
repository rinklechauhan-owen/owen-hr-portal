import { Inbox } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { z } from "zod"

import { EmployeeFilter } from "@/components/admin/employee-combobox"
import { LeaveReviewActions } from "@/components/admin/leave-review-actions"
import { DataTable } from "@/components/shared/data-table"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterDropdown } from "@/components/shared/filter-dropdown"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { LeaveStatusBadge } from "@/components/shared/status-badge"
import { requireSession } from "@/lib/permissions"
import { getLeaveTypes } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatDateRange, formatDays } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"
import { LEAVE_STATUSES } from "@/lib/validations/leave"

export const metadata: Metadata = { title: "Leave Management" }

const filtersSchema = z.object({
  status: z.enum([...LEAVE_STATUSES, "all"]).catch("pending"),
  employee: z.uuid().optional().catch(undefined),
  type: z.uuid().optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
})

type Row = {
  id: string
  start_date: string
  end_date: string
  total_days: number
  reason: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  rejection_reason: string | null
  cancellation_reason: string | null
  created_at: string
  employee: { id: string; first_name: string; last_name: string; employee_code: string; profile_id: string | null } | null
  leave_type: { name: string } | null
}

export default async function AdminLeavePage({ searchParams }: PageProps<"/admin/leave">) {
  const session = await requireSession()
  const params = flattenParams(await searchParams)
  const filters = filtersSchema.parse(params)
  const { from, to } = pageRange(filters.page)
  const supabase = await createClient()

  let query = supabase
    .from("leave_requests")
    .select(
      "id, start_date, end_date, total_days, reason, status, rejection_reason, cancellation_reason, created_at, employee:employees(id, first_name, last_name, employee_code, profile_id), leave_type:leave_types(name)",
      { count: "exact" }
    )
    .range(from, to)
  // Oldest first while reviewing, newest first otherwise.
  query = filters.status === "pending" ? query.order("created_at", { ascending: true }) : query.order("start_date", { ascending: false })
  if (filters.status !== "all") query = query.eq("status", filters.status)
  if (filters.employee) query = query.eq("employee_id", filters.employee)
  if (filters.type) query = query.eq("leave_type_id", filters.type)
  // Requests that overlap the chosen dates.
  if (filters.from) query = query.gte("end_date", filters.from)
  if (filters.to) query = query.lte("start_date", filters.to)

  const [{ data, count, error }, leaveTypes, selectedEmployee] = await Promise.all([
    query,
    getLeaveTypes(),
    filters.employee
      ? supabase.from("employees").select("first_name, last_name").eq("id", filters.employee).maybeSingle()
      : Promise.resolve({ data: null }),
  ])
  if (error) throw error
  const rows = (data ?? []) as Row[]

  const summary = (row: Row) =>
    `${formatDays(row.total_days)} of ${row.leave_type?.name} for ${row.employee?.first_name} ${row.employee?.last_name} (${formatDateRange(row.start_date, row.end_date)})`

  return (
    <>
      <PageHeader title="Leave Management" description="Review requests, approve or reject them, and track leave across the team." />

      <div className="mb-4 flex flex-col gap-2 lg:flex-row lg:flex-wrap lg:items-center">
        <FilterDropdown
          param="status"
          label="Status"
          allLabel="All statuses"
          defaultValue="pending"
          options={LEAVE_STATUSES.map((s) => ({ value: s, label: s[0].toUpperCase() + s.slice(1) }))}
        />
        <EmployeeFilter
          selectedLabel={selectedEmployee.data ? `${selectedEmployee.data.first_name} ${selectedEmployee.data.last_name}` : null}
        />
        <FilterDropdown
          param="type"
          label="Leave type"
          allLabel="All leave types"
          options={leaveTypes.map((t) => ({ value: t.id, label: t.name }))}
        />
        <DateRangeFilter />
      </div>

      <DataTable<Row>
        caption="Leave requests"
        rows={rows}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={Inbox}
            title={filters.status === "pending" ? "No requests waiting for review" : "No leave requests found"}
            description={filters.status === "pending" ? "You're all caught up." : "Try changing the filters."}
          />
        }
        columns={[
          {
            header: "Employee",
            cell: (row) => (
              <Link href={`/admin/employees/${row.employee?.id}?tab=leave`} className="group block">
                <span className="block font-medium group-hover:text-brand">
                  {row.employee?.first_name} {row.employee?.last_name}
                </span>
                <span className="block font-mono text-xs text-muted-foreground">{row.employee?.employee_code}</span>
              </Link>
            ),
          },
          {
            header: "Leave",
            className: "max-w-xs",
            cell: (row) => (
              <div className="space-y-0.5 whitespace-normal">
                <span className="block font-medium">{row.leave_type?.name}</span>
                <span className="block text-sm text-muted-foreground">
                  {formatDateRange(row.start_date, row.end_date)} · {formatDays(row.total_days)}
                </span>
                <span className="line-clamp-2 block text-xs text-muted-foreground" title={row.reason}>
                  {row.reason}
                </span>
                {row.rejection_reason && <span className="block text-xs text-destructive">Rejected: {row.rejection_reason}</span>}
                {row.cancellation_reason && <span className="block text-xs text-muted-foreground">Revoked: {row.cancellation_reason}</span>}
              </div>
            ),
          },
          { header: "Requested", cell: (row) => formatDate(row.created_at.slice(0, 10)) },
          { header: "Status", cell: (row) => <LeaveStatusBadge status={row.status} /> },
          {
            header: "Actions",
            cell: (row) => (
              <LeaveReviewActions
                requestId={row.id}
                status={row.status}
                summary={summary(row)}
                canReview={row.employee?.profile_id !== session.userId}
              />
            ),
          },
        ]}
        mobileCard={(row) => (
          <article className="space-y-3 rounded-xl border bg-card p-4 shadow-card">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium">
                  {row.employee?.first_name} {row.employee?.last_name}
                </p>
                <p className="text-sm text-muted-foreground">
                  {row.leave_type?.name} · {formatDateRange(row.start_date, row.end_date)} · {formatDays(row.total_days)}
                </p>
              </div>
              <LeaveStatusBadge status={row.status} />
            </div>
            <p className="text-sm text-foreground/80">{row.reason}</p>
            {row.rejection_reason && <p className="text-sm text-destructive">Rejected: {row.rejection_reason}</p>}
            <LeaveReviewActions
              requestId={row.id}
              status={row.status}
              summary={summary(row)}
              canReview={row.employee?.profile_id !== session.userId}
            />
          </article>
        )}
      />

      <Pagination basePath="/admin/leave" params={params} page={filters.page} total={count ?? 0} />
    </>
  )
}
