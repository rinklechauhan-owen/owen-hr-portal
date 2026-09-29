"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { deleteHoliday } from "@/app/admin/holidays/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"

export function DeleteHolidayButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${name}`}>
          <Trash2 aria-hidden />
        </Button>
      }
      title={`Delete ${name}?`}
      description="It will be removed from every employee's calendar. Leave requests already submitted keep their day count."
      confirmLabel="Delete holiday"
      destructive
      onConfirm={async () => {
        const result = await deleteHoliday(id)
        if (result.ok) router.refresh()
        return result
      }}
    />
  )
}
