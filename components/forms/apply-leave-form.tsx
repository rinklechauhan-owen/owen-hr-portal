"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useQuery } from "@tanstack/react-query"
import { CalendarCheck, Info } from "lucide-react"
import { useRouter } from "next/navigation"
import { useEffect, useMemo, useState, useTransition } from "react"
import { Controller, useForm, useWatch } from "react-hook-form"
import { toast } from "sonner"

import { applyForLeave } from "@/app/employee/leave/actions"
import { FormAlert } from "@/components/forms/form-alert"
import { SubmitButton } from "@/components/shared/submit-button"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase/browser"
import { cn } from "@/lib/utils"
import { formatDays } from "@/lib/utils/format"
import { type ApplyLeaveInput, applyLeaveSchema } from "@/lib/validations/leave"

export type LeaveTypeOption = {
  id: string
  name: string
  description: string | null
  requires_balance: boolean
  /** Available days per year, for balance-tracked types. */
  available: Record<number, number>
}

function useDebounced<T>(value: T, delay = 300) {
  const [debounced, setDebounced] = useState(value)
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay)
    return () => clearTimeout(timer)
  }, [value, delay])
  return debounced
}

export function ApplyLeaveForm({
  leaveTypes,
  minDate,
  maxDate,
  currentYear,
}: {
  leaveTypes: LeaveTypeOption[]
  minDate: string
  maxDate: string
  currentYear: number
}) {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()

  const form = useForm<ApplyLeaveInput>({
    resolver: zodResolver(applyLeaveSchema),
    defaultValues: { leave_type_id: "", start_date: "", end_date: "", reason: "" },
  })
  const { errors } = form.formState
  const [typeId, start, end] = useWatch({ control: form.control, name: ["leave_type_id", "start_date", "end_date"] })
  const range = useDebounced({ start, end })
  const type = leaveTypes.find((t) => t.id === typeId)

  // Preview only: the database recalculates the days when the request is saved.
  const preview = useQuery({
    queryKey: ["leave-days", range.start, range.end],
    enabled: Boolean(range.start && range.end && range.end >= range.start),
    queryFn: async () => {
      const { data, error } = await supabase.rpc("calculate_leave_days", {
        p_start_date: range.start,
        p_end_date: range.end,
      })
      if (error) throw error
      return data
    },
  })

  const days = preview.data ?? null
  const year = start ? Number(start.slice(0, 4)) : null
  const available = type?.requires_balance && year ? type.available[year] : undefined
  const exceeds = available !== undefined && days !== null && days > available

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = await applyForLeave(values)
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      router.push("/employee/leave/history")
      router.refresh()
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert message={error} />

      <FieldGroup className="rounded-xl border bg-card p-5 shadow-card">
        <Field data-invalid={Boolean(errors.leave_type_id)}>
          <FieldLabel htmlFor="leave_type_id">Leave type</FieldLabel>
          <Controller
            control={form.control}
            name="leave_type_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger id="leave_type_id" className="w-full" aria-invalid={Boolean(errors.leave_type_id)}>
                  <SelectValue placeholder="Choose a leave type" />
                </SelectTrigger>
                <SelectContent>
                  {leaveTypes.map((option) => {
                    const thisYear = option.available[currentYear]
                    return (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                        {option.requires_balance && thisYear !== undefined && (
                          <span className="text-muted-foreground"> · {formatDays(thisYear)} left</span>
                        )}
                      </SelectItem>
                    )
                  })}
                </SelectContent>
              </Select>
            )}
          />
          {type?.description && <FieldDescription>{type.description}</FieldDescription>}
          <FieldError errors={[errors.leave_type_id]} />
        </Field>

        <div className="grid gap-5 sm:grid-cols-2">
          <Field data-invalid={Boolean(errors.start_date)}>
            <FieldLabel htmlFor="start_date">Start date</FieldLabel>
            <Input
              id="start_date"
              type="date"
              min={minDate}
              max={maxDate}
              aria-invalid={Boolean(errors.start_date)}
              {...form.register("start_date", {
                onChange: (event) => {
                  const value = event.target.value as string
                  const currentEnd = form.getValues("end_date")
                  if (value && (!currentEnd || currentEnd < value)) form.setValue("end_date", value)
                },
              })}
            />
            <FieldError errors={[errors.start_date]} />
          </Field>
          <Field data-invalid={Boolean(errors.end_date)}>
            <FieldLabel htmlFor="end_date">End date</FieldLabel>
            <Input
              id="end_date"
              type="date"
              min={start || minDate}
              max={maxDate}
              aria-invalid={Boolean(errors.end_date)}
              {...form.register("end_date")}
            />
            <FieldError errors={[errors.end_date]} />
          </Field>
        </div>

        <div
          aria-live="polite"
          className={cn(
            "flex items-start gap-3 rounded-lg border px-4 py-3 text-sm",
            exceeds ? "border-destructive/25 bg-danger-soft text-destructive" : "border-info/20 bg-info-soft text-foreground"
          )}
        >
          {exceeds ? <Info className="mt-0.5 size-4 shrink-0" aria-hidden /> : <CalendarCheck className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />}
          <div>
            {!start || !end ? (
              <p className="text-muted-foreground">Choose your dates to see how many working days this uses.</p>
            ) : end < start ? (
              <p>End date cannot be before start date.</p>
            ) : preview.isFetching && days === null ? (
              <p className="text-muted-foreground">Calculating…</p>
            ) : preview.isError ? (
              <p>Unable to calculate the days right now. You can still submit; HR will see the correct total.</p>
            ) : days === 0 ? (
              <p>These dates are weekends or company holidays, so no leave is needed.</p>
            ) : days !== null ? (
              <p>
                This request uses <strong className="font-semibold">{formatDays(days)}</strong>
                {available !== undefined && !exceeds && <> · you&apos;ll have {formatDays(available - days)} left</>}
                {exceeds && <> but you have {formatDays(Math.max(available ?? 0, 0))} available</>}.
                <span className="block text-xs text-muted-foreground">Weekends and company holidays are not counted.</span>
              </p>
            ) : null}
          </div>
        </div>

        <Field data-invalid={Boolean(errors.reason)}>
          <FieldLabel htmlFor="reason">Reason</FieldLabel>
          <Textarea
            id="reason"
            rows={4}
            maxLength={1000}
            placeholder="A short note for HR, e.g. family function"
            aria-invalid={Boolean(errors.reason)}
            {...form.register("reason")}
          />
          <FieldError errors={[errors.reason]} />
        </Field>
      </FieldGroup>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <SubmitButton pending={pending} pendingLabel="Submitting…" size="lg" disabled={exceeds || days === 0}>
          Submit request
        </SubmitButton>
      </div>
    </form>
  )
}
