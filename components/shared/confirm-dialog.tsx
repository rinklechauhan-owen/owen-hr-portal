"use client"

import { useId, useState, useTransition } from "react"
import { toast } from "sonner"

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
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field"
import { Textarea } from "@/components/ui/textarea"
import type { ActionResult } from "@/types/actions"

type Props = {
  trigger: React.ReactNode
  title: string
  description?: React.ReactNode
  confirmLabel: string
  pendingLabel?: string
  destructive?: boolean
  /** Ask for a written reason (required, 3–1000 characters) before confirming. */
  reason?: { label: string; placeholder?: string; hint?: string }
  onConfirm: (reason: string) => Promise<ActionResult<unknown>>
  successMessage?: string
}

/** An accessible confirmation step for actions that change important records. */
export function ConfirmDialog({
  trigger,
  title,
  description,
  confirmLabel,
  pendingLabel,
  destructive = false,
  reason,
  onConfirm,
  successMessage,
}: Props) {
  const [open, setOpen] = useState(false)
  const [text, setText] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const reasonId = useId()

  function submit(event: React.FormEvent) {
    event.preventDefault()
    const value = text.trim()
    if (reason && value.length < 3) {
      setError(`Please enter ${reason.label.toLowerCase()}.`)
      return
    }
    if (reason && value.length > 1000) {
      setError("Please keep it to 1000 characters or fewer.")
      return
    }
    setError(null)
    startTransition(async () => {
      const result = await onConfirm(value)
      if (result.ok) {
        toast.success(result.message ?? successMessage ?? "Done.")
        setOpen(false)
        setText("")
      } else {
        setError(result.error)
      }
    })
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending) return
        setOpen(next)
        if (!next) setError(null)
      }}
    >
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="grid gap-4">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            {description && <DialogDescription>{description}</DialogDescription>}
          </DialogHeader>

          {reason && (
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor={reasonId}>{reason.label}</FieldLabel>
              <Textarea
                id={reasonId}
                value={text}
                onChange={(event) => setText(event.target.value)}
                placeholder={reason.placeholder}
                rows={3}
                maxLength={1000}
                aria-invalid={Boolean(error)}
                autoFocus
              />
              {reason.hint && <FieldDescription>{reason.hint}</FieldDescription>}
            </Field>
          )}
          {error && <FieldError>{error}</FieldError>}

          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>
                Cancel
              </Button>
            </DialogClose>
            <SubmitButton
              pending={pending}
              pendingLabel={pendingLabel}
              className={destructive ? "bg-destructive text-white hover:bg-destructive/90" : undefined}
            >
              {confirmLabel}
            </SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
