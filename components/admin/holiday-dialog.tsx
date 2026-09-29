"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"

import { saveHoliday } from "@/app/admin/holidays/actions"
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
import { type HolidayInput, holidaySchema } from "@/lib/validations/holiday"

export function HolidayDialog({ holiday }: { holiday?: HolidayInput & { id: string } }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<HolidayInput>({
    resolver: zodResolver(holidaySchema),
    defaultValues: holiday ?? { name: "", holiday_date: "", description: "", is_optional: false },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await saveHoliday(holiday?.id ?? null, values)
      if (!result.ok) return setError(result.error)
      toast.success(result.message)
      setOpen(false)
      if (!holiday) form.reset()
      router.refresh()
    })
  })

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) setError(null) }}>
      <DialogTrigger asChild>
        {holiday ? (
          <Button variant="ghost" size="icon-sm" aria-label={`Edit ${holiday.name}`}>
            <Pencil aria-hidden />
          </Button>
        ) : (
          <Button>
            <Plus aria-hidden />
            Add holiday
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={onSubmit} noValidate className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{holiday ? "Edit holiday" : "Add holiday"}</DialogTitle>
            <DialogDescription>
              Mandatory holidays are skipped when counting leave days. Existing leave requests keep the day count they were submitted with.
            </DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <FieldGroup>
            <Field data-invalid={Boolean(errors.name)}>
              <FieldLabel htmlFor="holiday-name">Name</FieldLabel>
              <Input id="holiday-name" placeholder="e.g. Diwali" aria-invalid={Boolean(errors.name)} {...form.register("name")} />
              <FieldError errors={[errors.name]} />
            </Field>
            <Field data-invalid={Boolean(errors.holiday_date)}>
              <FieldLabel htmlFor="holiday-date">Date</FieldLabel>
              <Input id="holiday-date" type="date" aria-invalid={Boolean(errors.holiday_date)} {...form.register("holiday_date")} />
              <FieldError errors={[errors.holiday_date]} />
            </Field>
            <Field data-invalid={Boolean(errors.description)}>
              <FieldLabel htmlFor="holiday-description">Description</FieldLabel>
              <Textarea id="holiday-description" rows={2} placeholder="Optional" {...form.register("description")} />
              <FieldError errors={[errors.description]} />
            </Field>
            <Field orientation="horizontal">
              <Controller
                control={form.control}
                name="is_optional"
                render={({ field }) => (
                  <Checkbox id="holiday-optional" checked={field.value} onCheckedChange={(next) => field.onChange(next === true)} />
                )}
              />
              <FieldContent>
                <FieldLabel htmlFor="holiday-optional">Optional holiday</FieldLabel>
                <FieldDescription>Employees may take it as leave; it still counts as a working day.</FieldDescription>
              </FieldContent>
            </Field>
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
