import type { LucideIcon } from "lucide-react"
import Link from "next/link"

import { cn } from "@/lib/utils"

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = "default",
}: {
  label: string
  value: React.ReactNode
  icon?: LucideIcon
  hint?: React.ReactNode
  href?: string
  tone?: "default" | "attention"
}) {
  const body = (
    <div
      className={cn(
        "flex h-full flex-col gap-3 rounded-xl border bg-card p-4 shadow-card transition-colors sm:p-5",
        href && "hover:border-brand/40",
        tone === "attention" && "border-warning/40"
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {Icon && (
          <span
            className={cn(
              "flex size-8 items-center justify-center rounded-lg bg-secondary text-primary",
              tone === "attention" && "bg-warning-soft text-warning"
            )}
            aria-hidden
          >
            <Icon className="size-4" />
          </span>
        )}
      </div>
      <div className="text-2xl font-semibold tabular-nums text-foreground sm:text-3xl">{value}</div>
      {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
    </div>
  )

  if (!href) return body
  return (
    <Link href={href} className="block rounded-xl">
      {body}
    </Link>
  )
}
