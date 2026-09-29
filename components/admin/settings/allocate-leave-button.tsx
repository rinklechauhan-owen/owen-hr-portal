"use client"

import { CalendarPlus } from "lucide-react"

import { allocateLeave } from "@/app/admin/settings/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"

export function AllocateLeaveButton({ year }: { year: number }) {
  return (
    <ConfirmDialog
      trigger={
        <Button variant="outline" size="sm">
          <CalendarPlus aria-hidden />
          Allocate {year} leave
        </Button>
      }
      title={`Allocate leave for ${year}?`}
      description={`Every active employee gets the default days for each leave type in ${year}. Balances that already exist are not changed.`}
      confirmLabel="Allocate"
      pendingLabel="Allocating…"
      onConfirm={() => allocateLeave(year)}
    />
  )
}
