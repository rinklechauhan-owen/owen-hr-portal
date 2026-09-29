import { cn } from "@/lib/utils"

/** Label/value pairs as an accessible description list. */
export function DetailList({
  items,
  className,
}: {
  items: { label: string; value: React.ReactNode }[]
  className?: string
}) {
  return (
    <dl className={cn("grid gap-x-6 gap-y-4 sm:grid-cols-2", className)}>
      {items.map((item) => (
        <div key={item.label} className="min-w-0 space-y-1">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{item.label}</dt>
          <dd className="truncate text-sm text-foreground">{item.value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  )
}
