"use client"

import { Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"

import { deleteDocument } from "@/app/admin/payroll/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button } from "@/components/ui/button"
import type { DocumentKind } from "@/lib/validations/payroll"

export function DeleteDocumentButton({ kind, id, title }: { kind: DocumentKind; id: string; title: string }) {
  const router = useRouter()
  return (
    <ConfirmDialog
      trigger={
        <Button variant="ghost" size="icon-sm" aria-label={`Delete ${title}`}>
          <Trash2 aria-hidden />
        </Button>
      }
      title="Delete this document?"
      description={`${title} will be permanently removed and the employee will no longer see it.`}
      confirmLabel="Delete document"
      destructive
      onConfirm={async () => {
        const result = await deleteDocument(kind, id)
        if (result.ok) router.refresh()
        return result
      }}
    />
  )
}
