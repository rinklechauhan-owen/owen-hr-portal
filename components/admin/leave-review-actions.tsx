"use client"

import { Check, Undo2, X } from "lucide-react"

import { reviewLeave, revokeLeave } from "@/app/admin/leave/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"

export function LeaveReviewActions({
  requestId,
  status,
  summary,
  canReview,
}: {
  requestId: string
  status: "pending" | "approved" | "rejected" | "cancelled"
  /** e.g. "3 days of Casual Leave for Asha Nair (5 Oct – 7 Oct 2026)" */
  summary: string
  /** False when the request is the admin's own. */
  canReview: boolean
}) {
  if (!canReview) {
    return <span className="text-xs text-muted-foreground">Your own request</span>
  }

  if (status === "pending") {
    return (
      <div className="flex flex-wrap gap-2">
        <ConfirmDialog
          trigger={
            <Button size="sm">
              <Check aria-hidden />
              Approve
            </Button>
          }
          title="Approve leave?"
          description={`Approve ${summary}. The days will be deducted from their balance.`}
          confirmLabel="Approve"
          pendingLabel="Approving…"
          onConfirm={() => reviewLeave({ request_id: requestId, decision: "approved" })}
        />
        <ConfirmDialog
          trigger={
            <Button size="sm" variant="outline">
              <X aria-hidden />
              Reject
            </Button>
          }
          title="Reject leave?"
          description={`Reject ${summary}. The employee will see your reason.`}
          confirmLabel="Reject"
          pendingLabel="Rejecting…"
          destructive
          reason={{ label: "Rejection reason", placeholder: "e.g. Project deadline that week" }}
          onConfirm={(reason) => reviewLeave({ request_id: requestId, decision: "rejected", rejection_reason: reason })}
        />
      </div>
    )
  }

  if (status === "approved") {
    return (
      <ConfirmDialog
        trigger={
          <Button size="sm" variant="ghost">
            <Undo2 aria-hidden />
            Revoke
          </Button>
        }
        title="Revoke approved leave?"
        description={`Revoke ${summary}. The days go back to their balance and the employee is notified.`}
        confirmLabel="Revoke leave"
        pendingLabel="Revoking…"
        destructive
        reason={{ label: "Reason for revoking", placeholder: "e.g. Dates changed at the employee's request" }}
        onConfirm={(reason) => revokeLeave({ request_id: requestId, reason })}
      />
    )
  }

  return null
}
