"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"

import { requestPasswordReset } from "@/app/(auth)/actions"
import { FormAlert } from "@/components/forms/form-alert"
import { SubmitButton } from "@/components/shared/submit-button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { type ForgotPasswordInput, forgotPasswordSchema } from "@/lib/validations/auth"

export function ForgotPasswordForm() {
  const [message, setMessage] = useState<{ tone: "error" | "success"; text: string } | null>(null)
  const [pending, startTransition] = useTransition()
  const form = useForm<ForgotPasswordInput>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })
  const { errors } = form.formState

  const onSubmit = form.handleSubmit((values) => {
    setMessage(null)
    startTransition(async () => {
      const result = await requestPasswordReset(values)
      setMessage(result.ok ? { tone: "success", text: result.message ?? "" } : { tone: "error", text: result.error })
      if (result.ok) form.reset()
    })
  })

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-5">
      <FormAlert message={message?.text} tone={message?.tone} />
      <Field data-invalid={Boolean(errors.email)}>
        <FieldLabel htmlFor="email">Email</FieldLabel>
        <Input
          id="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          aria-invalid={Boolean(errors.email)}
          {...form.register("email")}
        />
        <FieldError errors={[errors.email]} />
      </Field>
      <SubmitButton pending={pending} pendingLabel="Sending…" size="lg" className="w-full">
        Send reset link
      </SubmitButton>
    </form>
  )
}
