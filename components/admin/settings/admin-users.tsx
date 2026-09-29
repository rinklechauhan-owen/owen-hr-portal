"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { ShieldPlus, UserPlus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { inviteAdmin, promoteEmployeeToAdmin, setAdminRole } from "@/app/admin/settings/actions"
import { EmployeeCombobox, type EmployeeOption } from "@/components/admin/employee-combobox"
import { FormAlert } from "@/components/forms/form-alert"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { StatusBadge } from "@/components/shared/status-badge"
import { SubmitButton } from "@/components/shared/submit-button"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Field, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { inviteAdminSchema } from "@/lib/validations/settings"

type Admin = { id: string; full_name: string; email: string; is_active: boolean; hasEmployeeRecord: boolean }

function InviteAdminDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<z.input<typeof inviteAdminSchema>>({
    resolver: zodResolver(inviteAdminSchema),
    defaultValues: { full_name: "", email: "" },
  })
  const { errors } = form.formState

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null) }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <UserPlus aria-hidden />
          Invite admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          noValidate
          className="grid gap-4"
          onSubmit={form.handleSubmit((values) =>
            startTransition(async () => {
              const result = await inviteAdmin(values)
              if (!result.ok) return setError(result.error)
              toast.success(result.message)
              setOpen(false)
              form.reset()
              router.refresh()
            })
          )}
        >
          <DialogHeader>
            <DialogTitle>Invite an admin</DialogTitle>
            <DialogDescription>For people who need the Admin Portal but are not employees. For employees, use “Make an employee admin”.</DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <FieldGroup>
            <Field data-invalid={Boolean(errors.full_name)}>
              <FieldLabel htmlFor="admin-name">Name</FieldLabel>
              <Input id="admin-name" aria-invalid={Boolean(errors.full_name)} {...form.register("full_name")} />
              <FieldError errors={[errors.full_name]} />
            </Field>
            <Field data-invalid={Boolean(errors.email)}>
              <FieldLabel htmlFor="admin-email">Email</FieldLabel>
              <Input id="admin-email" type="email" aria-invalid={Boolean(errors.email)} {...form.register("email")} />
              <FieldError errors={[errors.email]} />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>Cancel</Button>
            </DialogClose>
            <SubmitButton pending={pending} pendingLabel="Sending…">Send invite</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

function PromoteEmployeeDialog() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [employee, setEmployee] = useState<EmployeeOption | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); setError(null); setEmployee(null) }}>
      <DialogTrigger asChild>
        <Button size="sm">
          <ShieldPlus aria-hidden />
          Make an employee admin
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            if (!employee) return setError("Choose an employee.")
            startTransition(async () => {
              const result = await promoteEmployeeToAdmin(employee.id)
              if (!result.ok) return setError(result.error)
              toast.success(result.message)
              setOpen(false)
              router.refresh()
            })
          }}
        >
          <DialogHeader>
            <DialogTitle>Make an employee admin</DialogTitle>
            <DialogDescription>They keep their Employee Portal and can also use the Admin Portal.</DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <Field>
            <FieldLabel htmlFor="promote-employee">Employee</FieldLabel>
            <EmployeeCombobox id="promote-employee" value={employee?.id ?? null} selectedLabel={employee?.label} onSelect={setEmployee} activeOnly />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>Cancel</Button>
            </DialogClose>
            <SubmitButton pending={pending} pendingLabel="Saving…">Make admin</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}

export function AdminUsers({ admins, currentUserId }: { admins: Admin[]; currentUserId: string }) {
  const router = useRouter()
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap justify-end gap-2">
        <InviteAdminDialog />
        <PromoteEmployeeDialog />
      </div>
      <ul className="divide-y rounded-xl border bg-card">
        {admins.map((admin) => (
          <li key={admin.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="flex items-center gap-2 text-sm font-medium">
                {admin.full_name || admin.email}
                {admin.id === currentUserId && <StatusBadge tone="brand">You</StatusBadge>}
                {!admin.is_active && <StatusBadge>Disabled</StatusBadge>}
              </p>
              <p className="truncate text-xs text-muted-foreground">{admin.email}</p>
            </div>
            {admin.id !== currentUserId && admin.hasEmployeeRecord && (
              <ConfirmDialog
                trigger={<Button variant="ghost" size="sm">Remove admin</Button>}
                title="Remove admin access?"
                description={`${admin.full_name || admin.email} will keep their Employee Portal but lose the Admin Portal.`}
                confirmLabel="Remove admin access"
                destructive
                onConfirm={async () => {
                  const result = await setAdminRole(admin.id, "employee")
                  if (result.ok) router.refresh()
                  return result
                }}
              />
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
