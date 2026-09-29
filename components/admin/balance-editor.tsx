"use client"

import { Pencil, Plus } from "lucide-react"
import { useRouter } from "next/navigation"
import { useId, useState, useTransition } from "react"
import { toast } from "sonner"

import { createBalance, updateBalance } from "@/app/admin/leave/actions"
import { FormAlert } from "@/components/forms/form-alert"
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
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { formatDays } from "@/lib/utils/format"

function useDialogAction() {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const run = (action: () => ReturnType<typeof updateBalance>) =>
    startTransition(async () => {
      const result = await action()
      if (!result.ok) {
        setError(result.error)
        return
      }
      toast.success(result.message)
      setOpen(false)
      router.refresh()
    })
  return { open, setOpen: (next: boolean) => { setOpen(next); if (!next) setError(null) }, error, pending, run }
}

export function EditAllocationButton({
  balanceId,
  leaveType,
  year,
  allocated,
  used,
}: {
  balanceId: string
  leaveType: string
  year: number
  allocated: number
  used: number
}) {
  const inputId = useId()
  const [value, setValue] = useState(String(allocated))
  const { open, setOpen, error, pending, run } = useDialogAction()

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" aria-label={`Edit ${leaveType} allocation`}>
          <Pencil aria-hidden />
          Edit
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => updateBalance({ balance_id: balanceId, allocated_days: Number(value) }))
          }}
        >
          <DialogHeader>
            <DialogTitle>{leaveType} · {year}</DialogTitle>
            <DialogDescription>Change how many days are allocated. Used days come from approved leave.</DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <Field>
            <FieldLabel htmlFor={inputId}>Allocated days</FieldLabel>
            <Input id={inputId} type="number" min={0} max={365} step={0.5} value={value} onChange={(e) => setValue(e.target.value)} required />
            <FieldDescription>{formatDays(used)} already used. Allocations below that are allowed but leave nothing to spend.</FieldDescription>
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

export function AddBalanceButton({
  employeeId,
  year,
  leaveTypes,
}: {
  employeeId: string
  year: number
  leaveTypes: { id: string; name: string; default_days: number }[]
}) {
  const typeId = useId()
  const daysId = useId()
  const [leaveTypeId, setLeaveTypeId] = useState(leaveTypes[0]?.id ?? "")
  const [days, setDays] = useState(String(leaveTypes[0]?.default_days ?? 0))
  const { open, setOpen, error, pending, run } = useDialogAction()

  if (leaveTypes.length === 0) return null

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus aria-hidden />
          Add balance
        </Button>
      </DialogTrigger>
      <DialogContent>
        <form
          className="grid gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            run(() => createBalance({ employee_id: employeeId, leave_type_id: leaveTypeId, year, allocated_days: Number(days) }))
          }}
        >
          <DialogHeader>
            <DialogTitle>Add leave balance for {year}</DialogTitle>
            <DialogDescription>For leave types this employee does not have a balance for yet.</DialogDescription>
          </DialogHeader>
          <FormAlert message={error} />
          <Field>
            <FieldLabel htmlFor={typeId}>Leave type</FieldLabel>
            <Select
              value={leaveTypeId}
              onValueChange={(value) => {
                setLeaveTypeId(value)
                setDays(String(leaveTypes.find((t) => t.id === value)?.default_days ?? 0))
              }}
            >
              <SelectTrigger id={typeId} className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leaveTypes.map((type) => (
                  <SelectItem key={type.id} value={type.id}>{type.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel htmlFor={daysId}>Allocated days</FieldLabel>
            <Input id={daysId} type="number" min={0} max={365} step={0.5} value={days} onChange={(e) => setDays(e.target.value)} required />
          </Field>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="outline" disabled={pending}>Cancel</Button>
            </DialogClose>
            <SubmitButton pending={pending} pendingLabel="Adding…">Add balance</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
