"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { Pencil } from "lucide-react"
import { useRouter } from "next/navigation"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { updateMyPhone } from "@/app/employee/profile/actions"
import { FormAlert } from "@/components/forms/form-alert"
import { SubmitButton } from "@/components/shared/submit-button"
import { Button } from "@/components/ui/button"
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { phoneSchema } from "@/lib/validations/employee"

export function PhoneForm({ phone }: { phone: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<{ phone: string }>({ resolver: zodResolver(phoneSchema), defaultValues: { phone: phone ?? "" } })
  const { errors } = form.formState

  if (!editing) {
    return (
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0 space-y-1">
          <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">Phone</p>
          <p className="text-sm">{phone ?? "Not added"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil aria-hidden />
          Edit
        </Button>
      </div>
    )
  }

  return (
    <form
      noValidate
      className="space-y-3"
      onSubmit={form.handleSubmit((values) =>
        startTransition(async () => {
          setError(null)
          const result = await updateMyPhone(values)
          if (!result.ok) return setError(result.error)
          toast.success(result.message)
          setEditing(false)
          router.refresh()
        })
      )}
    >
      <FormAlert message={error} />
      <Field data-invalid={Boolean(errors.phone)}>
        <FieldLabel htmlFor="phone">Phone</FieldLabel>
        <Input id="phone" type="tel" inputMode="tel" autoComplete="tel" placeholder="+91 98765 43210" aria-invalid={Boolean(errors.phone)} autoFocus {...form.register("phone")} />
        <FieldDescription>Leave empty to remove it.</FieldDescription>
        <FieldError errors={[errors.phone]} />
      </Field>
      <div className="flex gap-2">
        <SubmitButton pending={pending} pendingLabel="Saving…">Save</SubmitButton>
        <Button
          type="button"
          variant="ghost"
          onClick={() => {
            form.reset({ phone: phone ?? "" })
            setError(null)
            setEditing(false)
          }}
          disabled={pending}
        >
          Cancel
        </Button>
      </div>
    </form>
  )
}
