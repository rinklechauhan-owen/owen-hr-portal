import { CancelLeaveButton } from "@/components/employee/cancel-leave-button"
import { LeaveStatusBadge } from "@/components/shared/status-badge"
import type { LeaveRequestRow } from "@/lib/queries/leave"
import { formatDate, formatDateRange, formatDays } from "@/lib/utils/format"

export function LeaveRequestCard({ request, showActions = true }: { request: LeaveRequestRow; showActions?: boolean }) {
  return (
    <article className="rounded-xl border bg-card p-4 shadow-card">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-medium text-foreground">{request.leave_type?.name}</h3>
          <p className="text-sm text-muted-foreground">
            {formatDateRange(request.start_date, request.end_date)} · {formatDays(request.total_days)}
          </p>
        </div>
        <LeaveStatusBadge status={request.status} />
      </div>
      <p className="mt-3 line-clamp-2 text-sm text-foreground/80">{request.reason}</p>

      {request.status === "rejected" && request.rejection_reason && (
        <p className="mt-3 rounded-lg bg-danger-soft px-3 py-2 text-sm text-destructive">
          <span className="font-medium">Reason: </span>
          {request.rejection_reason}
        </p>
      )}
      {request.status === "cancelled" && request.cancellation_reason && (
        <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
          <span className="font-medium">Revoked by HR: </span>
          {request.cancellation_reason}
        </p>
      )}

      <div className="mt-3 flex items-center justify-between gap-3 border-t pt-3">
        <p className="text-xs text-muted-foreground">Requested {formatDate(request.created_at.slice(0, 10))}</p>
        {showActions && request.status === "pending" && <CancelLeaveButton requestId={request.id} />}
      </div>
    </article>
  )
}
