import { actionLabel, actionTone, describeAuditMetadata } from "@/lib/audit"
import { cn } from "@/lib/utils"
import { formatDateTime } from "@/lib/utils/format"
import type { Json } from "@/types/database"

export type ActivityEntry = {
  id: number
  action: string
  metadata: Json
  created_at: string
  actor: { full_name: string; email: string } | null
}

const DOT: Record<ReturnType<typeof actionTone>, string> = {
  neutral: "bg-muted-foreground/50",
  success: "bg-success",
  danger: "bg-destructive",
  warning: "bg-warning",
  info: "bg-brand",
}

export function ActivityList({ entries, showActor = true }: { entries: ActivityEntry[]; showActor?: boolean }) {
  return (
    <ol className="divide-y rounded-xl border bg-card shadow-card">
      {entries.map((entry) => {
        const detail = describeAuditMetadata(entry.action, entry.metadata)
        return (
          <li key={entry.id} className="flex gap-3 px-4 py-3">
            <span className={cn("mt-2 size-2 shrink-0 rounded-full", DOT[actionTone(entry.action)])} aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">{actionLabel(entry.action)}</p>
              {detail && <p className="truncate text-sm text-muted-foreground">{detail}</p>}
              <p className="mt-0.5 text-xs text-muted-foreground">
                {formatDateTime(entry.created_at)}
                {showActor && (
                  <> · {entry.actor ? entry.actor.full_name || entry.actor.email : "System"}</>
                )}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
