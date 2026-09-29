"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { saveCompanySettings } from "@/app/admin/settings/actions"
import { FormAlert } from "@/components/forms/form-alert"
import { SubmitButton } from "@/components/shared/submit-button"
import { Checkbox } from "@/components/ui/checkbox"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { companySettingsSchema, WEEKDAYS } from "@/lib/validations/settings"

type Values = z.input<typeof companySettingsSchema>

export function CompanySettingsForm({ defaultValues }: { defaultValues: Values }) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<Values>({ resolver: zodResolver(companySettingsSchema), defaultValues })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await saveCompanySettings(values)
      if (!result.ok) return setError(result.error)
      toast.success(result.message)
      router.refresh()
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert message={error} />
      <FieldGroup className="grid gap-5 sm:grid-cols-2">
        <Field data-invalid={Boolean(errors.company_name)} className="sm:col-span-2">
          <FieldLabel htmlFor="company_name">Company name</FieldLabel>
          <Input id="company_name" aria-invalid={Boolean(errors.company_name)} {...form.register("company_name")} />
          <FieldError errors={[errors.company_name]} />
        </Field>
        <Field data-invalid={Boolean(errors.max_backdate_days)}>
          <FieldLabel htmlFor="max_backdate_days">Backdating limit (days)</FieldLabel>
          <Input
            id="max_backdate_days"
            type="number"
            min={0}
            max={365}
            aria-invalid={Boolean(errors.max_backdate_days)}
            {...form.register("max_backdate_days", { valueAsNumber: true })}
          />
          <FieldDescription>How far in the past employees can request leave, e.g. for sick days.</FieldDescription>
          <FieldError errors={[errors.max_backdate_days]} />
        </Field>
        <Field data-invalid={Boolean(errors.max_advance_days)}>
          <FieldLabel htmlFor="max_advance_days">Advance limit (days)</FieldLabel>
          <Input
            id="max_advance_days"
            type="number"
            min={1}
            max={730}
            aria-invalid={Boolean(errors.max_advance_days)}
            {...form.register("max_advance_days", { valueAsNumber: true })}
          />
          <FieldDescription>How far ahead employees can plan leave.</FieldDescription>
          <FieldError errors={[errors.max_advance_days]} />
        </Field>
      </FieldGroup>

      <FieldSet>
        <FieldLegend variant="label">Weekend days</FieldLegend>
        <FieldDescription>These days are never counted as leave.</FieldDescription>
        <Controller
          control={form.control}
          name="weekend_days"
          render={({ field }) => (
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((day, index) => {
                const checked = field.value.includes(index)
                return (
                  <label
                    key={day}
                    className="flex h-10 cursor-pointer items-center gap-2 rounded-lg border bg-card px-3 text-sm has-[[data-state=checked]]:border-primary/40 has-[[data-state=checked]]:bg-secondary"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(next) =>
                        field.onChange(next ? [...field.value, index] : field.value.filter((d) => d !== index))
                      }
                    />
                    {day}
                  </label>
                )
              })}
            </div>
          )}
        />
        <FieldError errors={[errors.weekend_days as { message?: string } | undefined]} />
      </FieldSet>

      <div className="flex justify-end">
        <SubmitButton pending={pending} pendingLabel="Saving…">Save settings</SubmitButton>
      </div>
    </form>
  )
}
