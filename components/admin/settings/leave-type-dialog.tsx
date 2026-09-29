"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { saveLeaveType } from "@/app/admin/settings/actions"
import { FormAlert } from "@/components/forms/form-alert"
import { SubmitButton } from "@/components/shared/submit-button"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { leaveTypeSchema } from "@/lib/validations/leave"

type Values = z.input<typeof leaveTypeSchema>

export function LeaveTypeDialog({ leaveType }: { leaveType?: Values & { id: string } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<Values>({
    resolver: zodResolver(leaveTypeSchema),
    defaultValues: leaveType ?? { name: "", description: "", default_days: 0, requires_balance: true, is_active: true },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await saveLeaveType(leaveType?.id ?? null, values)
      if (!result.ok) return setError(result.error)
      toast.success(result.message)
      setOpen(false)
      if (!leaveType) form.reset()
      router.refresh()
    })
  })

  const checkbox = (name: "requires_balance" | "is_active", label: string, hint: string) => (
    <Field orientation="horizontal">
      <Controller
        control={form.control}
        name={name}
        render={({ field }) => (
          <Checkbox id={name} checked={field.value} onCheckedChange={(next) => field.onChange(next === true)} />
        )}
      />
      <FieldContent>
        <FieldLabel htmlFor={name}>{label}</FieldLabel>
        <FieldDescription>{hint}</FieldDescription>
      </FieldContent>
    </Field>
  )

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger asChild>
        {leaveType ? (
          <Button variant="ghost" size="sm" aria-label={`Edit ${leaveType.name}`}>
            <Pencil aria-hidden />
            Edit
          </Button>
        ) : (
          <Button size="sm">
            <Plus aria-hidden />
            Add leave type
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{leaveType ? `Edit ${leaveType.name}` : "Add leave type"}</DialogTitle>
            <DialogDescription>Changes to the default allocation apply to new balances only.</DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="lt-name">Name</FieldLabel>
              <Input id="lt-name" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="lt-description">Description</FieldLabel>
              <Textarea id="lt-description" rows={2} {...form.register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>
            <Field data-invalid={Boolean(errors.default_days)}>
              <FieldLabel htmlFor="lt-days">Default days per year</FieldLabel>
              <Input
                id="lt-days"
                type="number"
                min={0}
                max={365}
                step={0.5}
                aria-invalid={Boolean(errors.default_days)}
                {...form.register("default_days", { valueAsNumber: true })}
              />
              <FieldError errors={[errors.default_days]} />
            </Field>
            {checkbox("requires_balance", "Uses a balance", "Turn off for unpaid leave, which never runs out.")}
            {checkbox("is_active", "Available to employees", "Inactive types are hidden from the leave form.")}
          </FieldGroup>
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
