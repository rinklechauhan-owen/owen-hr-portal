import { StatusBadge } from "@/components/shared/status-badge"
import { cn } from "@/lib/utils"
import { formatDate } from "@/lib/utils/format"

export type Holiday = {
  id: string
  name: string
  holiday_date: string
  description: string | null
  is_optional: boolean
}

export function HolidayDateTile({ date, muted = false }: { date: string; muted?: boolean }) {
  return (
    <span
      className={cn(
        "flex size-12 shrink-0 flex-col items-center justify-center rounded-lg",
        muted ? "bg-muted text-muted-foreground" : "bg-secondary text-primary"
      )}
      aria-hidden
    >
      <span className="text-[0.65rem] font-semibold uppercase">{formatDate(date, "MMM")}</span>
      <span className="text-base leading-none font-semibold">{formatDate(date, "d")}</span>
    </span>
  )
}

export function HolidayCard({ holiday, past = false, actions }: { holiday: Holiday; past?: boolean; actions?: React.ReactNode }) {
  return (
    <div className={cn("flex items-center gap-3 rounded-xl border bg-card p-3 shadow-card", past && "opacity-70")}>
      <HolidayDateTile date={holiday.holiday_date} muted={past} />
      <div className="min-w-0 flex-1">
        <p className="flex flex-wrap items-center gap-2 font-medium">
          {holiday.name}
          {holiday.is_optional && <StatusBadge>Optional</StatusBadge>}
        </p>
        <p className="text-sm text-muted-foreground">{formatDate(holiday.holiday_date, "EEEE, d MMMM yyyy")}</p>
        {holiday.description && <p className="mt-0.5 line-clamp-2 text-xs text-muted-foreground">{holiday.description}</p>}
      </div>
      {actions}
    </div>
  )
}
