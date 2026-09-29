"use client"

import { Pencil, Plus, Trash2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"

import { deleteDepartment, saveDepartment } from "@/app/admin/settings/actions"
import { FormAlert } from "@/components/forms/form-alert"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { SubmitButton } from "@/components/shared/submit-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

function DepartmentDialog({ department }: { department?: { id: string; name: string } }) {
  const router = useRouter()
  const inputId = useId()
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(department?.name ?? "")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); if (next) setName(department?.name ?? "") }}>
      <DialogTrigger asChild>
        {department ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Rename ${department.name}`}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button size="sm">
            <Plus aria-hidden />
            Add department
          </Button>
        )}
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            startTransition(async () => {
              const result = await saveDepartment(department?.id ?? null, { name })
              if (!result.ok) return setError(result.error)
              toast.success(result.message)
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>{department ? "Rename department" : "Add department"}</DialogTitle>
          </DialogHeader>
          <FormAlert message={error} />
          <Field>
            <FieldLabel htmlFor={inputId}>Name</FieldLabel>
            <Input id={inputId} value={name} onChange={(e) => setName(e.target.value)} maxLength={80} required autoFocus />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>Cancel</Button>
            </DialogClose>
            <SubmitButton pending={pending} pendingLabel="Saving…">Save</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function DepartmentManager({ departments }: { departments: { id: string; name: string; employees: number }[] }) {
  const router = useRouter()
  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <DepartmentDialog />
      </div>
      {departments.length ? (
        <ul className="divide-y rounded-xl border bg-card">
          {departments.map((department) => (
            <li key={department.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
              <div>
                <p className="text-sm font-medium">{department.name}</p>
                <p className="text-xs text-muted-foreground">
                  {department.employees} employee{department.employees === 1 ? "" : "s"}
                </p>
              </div>
              <div className="flex items-center gap-1">
                <DepartmentDialog department={department} />
                <ConfirmDialog
                  trigger={
                    <Button variant="ghost" size="icon-sm" aria-label={`Delete ${department.name}`} disabled={department.employees > 0}>
                      <Trash2 aria-hidden />
                    </Button>
                  }
                  title={`Delete ${department.name}?`}
                  description="This cannot be undone."
                  confirmLabel="Delete"
                  destructive
                  onConfirm={async () => {
                    const result = await deleteDepartment(department.id)
                    if (result.ok) router.refresh()
                    return result
                  }}
                />
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <EmptyState compact title="No departments yet" description="Departments let you group and filter employees." />
      )}
    </div>
  )
}
