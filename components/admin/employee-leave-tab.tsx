import { CalendarRange, History } from "lucide-react"
import Link from "next/link"

import { AddBalanceButton, EditAllocationButton } from "@/components/admin/balance-editor"
import { LeaveReviewActions } from "@/components/admin/leave-review-actions"
import { DataTable } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { SectionHeader } from "@/components/shared/page-header"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { LeaveStatusBadge } from "@/components/shared/status-badge"
import { cn } from "@/lib/utils"
import { type BalanceWithType, getBalances, LEAVE_REQUEST_FIELDS, type LeaveRequestRow } from "@/lib/queries/leave"
import { getLeaveTypes } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDate, formatDateRange, formatDays } from "@/lib/utils/format"

export async function EmployeeLeaveTab({
  employeeId,
  employeeName,
  isSelf,
  year,
  currentYear,
  page,
  basePath,
}: {
  employeeId: string
  employeeName: string
  isSelf: boolean
  year: number
  currentYear: number
  page: number
  basePath: string
}) {
  const supabase = await createClient()
  const { from, to } = pageRange(page, 10)
  const [balances, leaveTypes, history] = await Promise.all([
    getBalances(employeeId, year),
    getLeaveTypes({ activeOnly: true }),
    supabase
      .from("leave_requests")
      .select(LEAVE_REQUEST_FIELDS, { count: "exact" })
      .eq("employee_id", employeeId)
      .order("start_date", { ascending: false })
      .range(from, to),
  ])
  if (history.error) throw history.error
  const requests = (history.data ?? []) as LeaveRequestRow[]
  const missingTypes = leaveTypes.filter((t) => t.requires_balance && !balances.some((b) => b.leave_type_id === t.id))
  const years = [currentYear - 1, currentYear, currentYear + 1]

  return (
    <div className="space-y-8">
      <section aria-labelledby="balances-heading">
        <SectionHeader
          title={<span id="balances-heading">Leave balances</span>}
          action={
            <div className="flex items-center gap-2">
              <nav aria-label="Balance year" className="flex rounded-lg border bg-card p-0.5">
                {years.map((y) => (
                  <Link
                    key={y}
                    href={`${basePath}?tab=leave&year=${y}`}
                    scroll={false}
                    aria-current={y === year ? "page" : undefined}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-sm text-muted-foreground tabular-nums",
                      y === year && "bg-secondary font-medium text-primary"
                    )}
                  >
                    {y}
                  </Link>
                ))}
              </nav>
              <AddBalanceButton employeeId={employeeId} year={year} leaveTypes={missingTypes} />
            </div>
          }
        />
        <DataTable<BalanceWithType>
          caption={`Leave balances for ${year}`}
          rows={balances}
          rowKey={(b) => b.id}
          empty={
            <EmptyState compact icon={CalendarRange} title={`No balances for ${year}`} description="Add a balance, or allocate leave for the whole company in Settings." />
          }
          columns={[
            { header: "Leave type", cell: (b) => <span className="font-medium">{b.leave_type?.name}</span> },
            { header: "Allocated", className: "text-right tabular-nums", cell: (b) => Number(b.allocated_days) },
            { header: "Used", className: "text-right tabular-nums", cell: (b) => Number(b.used_days) },
            { header: "Pending", className: "text-right tabular-nums", cell: (b) => Number(b.pending_days) },
            {
              header: "Available",
              className: "text-right tabular-nums",
              cell: (b) => (
                <span className={cn("font-semibold", Number(b.available_days) <= 0 && "text-destructive")}>{Number(b.available_days)}</span>
              ),
            },
            {
              header: "Edit",
              srOnlyHeader: true,
              className: "w-20 text-right",
              cell: (b) => (
                <EditAllocationButton
                  balanceId={b.id}
                  leaveType={b.leave_type?.name ?? "Leave"}
                  year={b.year}
                  allocated={Number(b.allocated_days)}
                  used={Number(b.used_days)}
                />
              ),
            },
          ]}
        />
      </section>

      <section aria-labelledby="history-heading">
        <SectionHeader title={<span id="history-heading">Leave history</span>} />
        <DataTable<LeaveRequestRow>
          caption="Leave history"
          rows={requests}
          rowKey={(r) => r.id}
          empty={<EmptyState compact icon={History} title="No leave requests yet" />}
          columns={[
            { header: "Leave", cell: (r) => <span className="font-medium">{r.leave_type?.name}</span> },
            { header: "Dates", cell: (r) => formatDateRange(r.start_date, r.end_date) },
            { header: "Days", className: "tabular-nums", cell: (r) => formatDays(r.total_days) },
            {
              header: "Reason",
              className: "max-w-xs",
              cell: (r) => (
                <span className="line-clamp-2 block whitespace-normal text-sm text-muted-foreground">
                  {r.reason}
                  {r.rejection_reason && <span className="block text-destructive">Rejected: {r.rejection_reason}</span>}
                </span>
              ),
            },
            { header: "Requested", cell: (r) => formatDate(r.created_at.slice(0, 10)) },
            { header: "Status", cell: (r) => <LeaveStatusBadge status={r.status} /> },
            {
              header: "Actions",
              cell: (r) => (
                <LeaveReviewActions
                  requestId={r.id}
                  status={r.status}
                  canReview={!isSelf}
                  summary={`${formatDays(r.total_days)} of ${r.leave_type?.name} for ${employeeName} (${formatDateRange(r.start_date, r.end_date)})`}
                />
              ),
            },
          ]}
        />
        <Pagination basePath={basePath} params={{ tab: "leave", year: String(year) }} page={page} total={history.count ?? 0} pageSize={10} />
      </section>
    </div>
  )
}
