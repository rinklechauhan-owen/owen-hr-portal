"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { Controller, useForm } from "react-hook-form"
import { toast } from "sonner"
import type { z } from "zod"

import { createEmployee, updateEmployee } from "@/app/admin/employees/actions"
import { FormAlert } from "@/components/forms/form-alert"
import { SubmitButton } from "@/components/shared/submit-button"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldSet, FieldLegend } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { type EmployeeInput, employeeSchema } from "@/lib/validations/employee"

const NO_DEPARTMENT = "__none__"

export function EmployeeForm({
  employeeId,
  defaultValues,
  departments,
}: {
  employeeId?: string
  defaultValues?: EmployeeInput
  departments: { id: string; name: string }[]
}) {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<EmployeeInput, unknown, z.output<typeof employeeSchema>>({
    resolver: zodResolver(employeeSchema),
    defaultValues: defaultValues ?? {
      employee_code: "",
      first_name: "",
      last_name: "",
      email: "",
      phone: "",
      department_id: "",
      designation: "",
      joining_date: "",
    },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setError(null)
    startTransition(async () => {
      const result = employeeId ? await updateEmployee(employeeId, values) : await createEmployee(values)
      if (!result.ok) {
        setError(result.error)
        for (const [field, messages] of Object.entries(result.fieldErrors ?? {})) {
          if (messages?.[0]) form.setError(field as keyof EmployeeInput, { message: messages[0] })
        }
        return
      }
      toast.success(result.message)
      const id = employeeId ?? (result.data as { id: string }).id
      router.push(`/admin/employees/${id}`)
      router.refresh()
    })
  })

  const text = (name: keyof EmployeeInput, label: string, props: React.ComponentProps<typeof Input> = {}, hint?: string) => (
    <Field data-invalid={Boolean(errors[name])}>
      <FieldLabel htmlFor={name}>{label}</FieldLabel>
      <Input id={name} aria-invalid={Boolean(errors[name])} {...props} {...form.register(name)} />
      {hint && <FieldDescription>{hint}</FieldDescription>}
      <FieldError errors={[errors[name]]} />
    </Field>
  )

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <FormAlert message={error} />

      <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <FieldSet>
          <FieldLegend>Personal details</FieldLegend>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            {text("first_name", "First name", { autoComplete: "off" })}
            {text("last_name", "Last name", { autoComplete: "off" })}
            {text("email", "Work email", { type: "email", inputMode: "email", autoComplete: "off" }, "Used to sign in to the portal.")}
            {text("phone", "Phone", { type: "tel", inputMode: "tel", placeholder: "+91 98765 43210" }, "Optional.")}
          </FieldGroup>
        </FieldSet>
      </div>

      <div className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
        <FieldSet>
          <FieldLegend>Employment</FieldLegend>
          <FieldGroup className="grid gap-5 sm:grid-cols-2">
            {text("employee_code", "Employee ID", { placeholder: "OM-014", className: "uppercase" })}
            {text("joining_date", "Joining date", { type: "date" })}
            <Field data-invalid={Boolean(errors.department_id)}>
              <FieldLabel htmlFor="department_id">Department</FieldLabel>
              <Controller
                control={form.control}
                name="department_id"
                render={({ field }) => (
                  <Select
                    value={field.value ? field.value : NO_DEPARTMENT}
                    onValueChange={(value) => field.onChange(value === NO_DEPARTMENT ? "" : value)}
                  >
                    <SelectTrigger id="department_id" className="w-full" aria-invalid={Boolean(errors.department_id)}>
                      <SelectValue placeholder="Choose a department" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NO_DEPARTMENT}>No department</SelectItem>
                      {departments.map((department) => (
                        <SelectItem key={department.id} value={department.id}>
                          {department.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {departments.length === 0 && (
                <FieldDescription>Add departments in Settings to group employees.</FieldDescription>
              )}
              <FieldError errors={[errors.department_id]} />
            </Field>
            {text("designation", "Designation", { placeholder: "e.g. SEO Specialist" }, "Optional.")}
          </FieldGroup>
        </FieldSet>
      </div>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending}>
          Cancel
        </Button>
        <SubmitButton pending={pending} pendingLabel="Saving…">
          {employeeId ? "Save changes" : "Add employee"}
        </SubmitButton>
      </div>
    </form>
  )
}
