import { cn } from "@/lib/utils"
import { formatDays } from "@/lib/utils/format"
import type { BalanceWithType } from "@/lib/queries/leave"

export function LeaveBalanceCard({ balance, compact = false }: { balance: BalanceWithType; compact?: boolean }) {
  const total = Number(balance.allocated_days)
  const used = Number(balance.used_days)
  const pending = Number(balance.pending_days)
  const available = Number(balance.available_days)
  const usedPct = total > 0 ? Math.min(100, (used / total) * 100) : 0
  const pendingPct = total > 0 ? Math.min(100 - usedPct, (pending / total) * 100) : 0

  return (
    <div className={cn("rounded-xl border bg-card shadow-card", compact ? "p-4" : "p-5")}>
      <p className="truncate text-sm font-medium text-muted-foreground">{balance.leave_type?.name}</p>
      <p className="mt-2 flex items-baseline gap-1.5">
        <span className="text-3xl font-semibold tabular-nums text-foreground">{Number.isInteger(available) ? available : available.toFixed(1)}</span>
        <span className="text-sm text-muted-foreground">{available === 1 ? "day left" : "days left"}</span>
      </p>
      <div
        className="mt-3 flex h-1.5 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${formatDays(used)} used and ${formatDays(pending)} pending of ${formatDays(total)}`}
      >
        <span className="bg-primary" style={{ width: `${usedPct}%` }} />
        <span className="bg-warning/60" style={{ width: `${pendingPct}%` }} />
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {formatDays(used)} used{pending > 0 && ` · ${formatDays(pending)} pending`} · {formatDays(total)} allocated
      </p>
    </div>
  )
}
