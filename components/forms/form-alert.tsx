import { AlertCircle, CheckCircle2 } from "lucide-react"

import { cn } from "@/lib/utils"

/** Form-level message, announced to screen readers when it appears. */
export function FormAlert({
  message,
  tone = "error",
  className,
}: {
  message?: string | null
  tone?: "error" | "success"
  className?: string
}) {
  if (!message) return null
  const Icon = tone === "error" ? AlertCircle : CheckCircle2
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2.5 rounded-lg border px-3.5 py-3 text-sm",
        tone === "error" ? "border-destructive/25 bg-danger-soft text-destructive" : "border-success/25 bg-success-soft text-success",
        className
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
      <span>{message}</span>
    </div>
  )
}
