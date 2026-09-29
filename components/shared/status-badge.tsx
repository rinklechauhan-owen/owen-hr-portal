import { cn } from "@/lib/utils"
import type { EmployeeStatus, LeaveStatus } from "@/types/database"

export type BadgeTone = "neutral" | "info" | "success" | "warning" | "danger" | "brand"

const TONES: Record<BadgeTone, string> = {
  neutral: "bg-muted text-muted-foreground border-border",
  info: "bg-info-soft text-info border-info/20",
  success: "bg-success-soft text-success border-success/20",
  warning: "bg-warning-soft text-warning border-warning/25",
  danger: "bg-danger-soft text-destructive border-destructive/20",
  brand: "bg-secondary text-primary border-primary/15",
}

export function StatusBadge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone
  children: React.ReactNode
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className
      )}
    >
      {children}
    </span>
  )
}

const LEAVE: Record<LeaveStatus, { tone: BadgeTone; label: string }> = {
  pending: { tone: "warning", label: "Pending" },
  approved: { tone: "success", label: "Approved" },
  rejected: { tone: "danger", label: "Rejected" },
  cancelled: { tone: "neutral", label: "Cancelled" },
}

export function LeaveStatusBadge({ status, className }: { status: LeaveStatus; className?: string }) {
  const { tone, label } = LEAVE[status]
  return (
    <StatusBadge tone={tone} className={className}>
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </StatusBadge>
  )
}

export function EmployeeStatusBadge({ status }: { status: EmployeeStatus }) {
  return status === "active" ? (
    <StatusBadge tone="success">Active</StatusBadge>
  ) : (
    <StatusBadge tone="neutral">Disabled</StatusBadge>
  )
}
