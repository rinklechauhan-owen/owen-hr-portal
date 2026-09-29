"use client"

import { KeyRound, Mail, Pencil, UserCheck, UserX } from "lucide-react"
import Link from "next/link"
import { useTransition } from "react"
import { toast } from "sonner"

import { grantPortalAccess, sendPasswordReset, setEmployeeStatus } from "@/app/admin/employees/actions"
import { ConfirmDialog } from "@/components/shared/confirm-dialog"
import { Button, buttonVariants } from "@/components/ui/button"

export function EmployeeActions({
  employeeId,
  name,
  email,
  status,
  hasLogin,
  isSelf,
}: {
  employeeId: string
  name: string
  email: string
  status: "active" | "inactive"
  hasLogin: boolean
  isSelf: boolean
}) {
  const [pending, startTransition] = useTransition()

  const resetPassword = () =>
    startTransition(async () => {
      const result = await sendPasswordReset(employeeId)
      if (result.ok) toast.success(result.message)
      else toast.error(result.error)
    })

  return (
    <>
      <Link href={`/admin/employees/${employeeId}/edit`} className={buttonVariants({ variant: "outline" })}>
        <Pencil aria-hidden />
        Edit
      </Link>

      {status === "active" && !hasLogin && (
        <ConfirmDialog
          trigger={
            <Button variant="outline">
              <Mail aria-hidden />
              Give portal access
            </Button>
          }
          title="Give portal access?"
          description={`We'll email an invite to ${email}. ${name} will choose a password and can then sign in to the Employee Portal.`}
          confirmLabel="Send invite"
          pendingLabel="Sending…"
          onConfirm={() => grantPortalAccess(employeeId)}
        />
      )}

      {status === "active" && hasLogin && (
        <Button variant="outline" onClick={resetPassword} disabled={pending}>
          <KeyRound aria-hidden />
          Send password reset
        </Button>
      )}

      {!isSelf &&
        (status === "active" ? (
          <ConfirmDialog
            trigger={
              <Button variant="destructive">
                <UserX aria-hidden />
                Disable
              </Button>
            }
            title={`Disable ${name}?`}
            description="They will be signed out and lose access to the portal straight away. Their records, leave history and payroll documents are kept, and you can enable them again at any time."
            confirmLabel="Disable employee"
            pendingLabel="Disabling…"
            destructive
            onConfirm={() => setEmployeeStatus(employeeId, "inactive")}
          />
        ) : (
          <ConfirmDialog
            trigger={
              <Button>
                <UserCheck aria-hidden />
                Enable
              </Button>
            }
            title={`Enable ${name}?`}
            description="They will be able to sign in and use the portal again."
            confirmLabel="Enable employee"
            pendingLabel="Enabling…"
            onConfirm={() => setEmployeeStatus(employeeId, "active")}
          />
        ))}
    </>
  )
}
