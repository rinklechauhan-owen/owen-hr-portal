"use client"

import { AlertTriangle, RotateCw } from "lucide-react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

export function ErrorState({
  title = "Unable to load this page.",
  description = "Please try again. If the problem continues, contact HR.",
  onRetry,
  className,
}: {
  title?: string
  description?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      role="alert"
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-xl border border-destructive/20 bg-danger-soft px-6 py-10 text-center",
        className
      )}
    >
      <span className="flex size-11 items-center justify-center rounded-full bg-card text-destructive" aria-hidden>
        <AlertTriangle className="size-5" />
      </span>
      <div className="space-y-1">
        <p className="font-medium text-foreground">{title}</p>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
      </div>
      {onRetry && (
        <Button variant="outline" onClick={onRetry}>
          <RotateCw aria-hidden />
          Try again
        </Button>
      )}
    </div>
  )
}

/** Drop-in body for route `error.tsx` files. */
export function RouteError({ reset, title }: { reset: () => void; title?: string }) {
  return <ErrorState title={title} onRetry={reset} className="my-6" />
}
