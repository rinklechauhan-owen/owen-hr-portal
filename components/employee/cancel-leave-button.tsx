"use client"

import { cancelLeave } from "@/app/employee/leave/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"

export function CancelLeaveButton({ requestId }: { requestId: string }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive">
          Cancel request
        </Button>
      }
      title="Cancel this leave request?"
      description="HR will no longer see it for review. You can submit a new request later."
      confirmLabel="Cancel request"
      pendingLabel="Cancelling…"
      destructive
      onConfirm={() => cancelLeave(requestId)}
    />
  )
}
