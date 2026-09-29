import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns"

import { cn } from "@/lib/utils"

export type CalendarLeave = {
  id: string
  start_date: string
  end_date: string
  status: "pending" | "approved"
  leave_type: string
}

export type CalendarHoliday = { id: string; name: string; holiday_date: string; is_optional: boolean }

const WEEK_STARTS_ON = 1 // Monday

/** A month grid of the employee's own leave and company holidays. */
export function MonthCalendar({
  month,
  today,
  leave,
  holidays,
  weekendDays,
}: {
  /** Any date inside the month, YYYY-MM-DD. */
  month: string
  today: string
  leave: CalendarLeave[]
  holidays: CalendarHoliday[]
  weekendDays: number[]
}) {
  const monthStart = startOfMonth(parseISO(month))
  const days = eachDayOfInterval({
    start: startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON }),
    end: endOfWeek(endOfMonth(monthStart), { weekStartsOn: WEEK_STARTS_ON }),
  })
  const weeks = Array.from({ length: days.length / 7 }, (_, i) => days.slice(i * 7, i * 7 + 7))
  const weekdayLabels = Array.from({ length: 7 }, (_, i) => addDays(startOfWeek(monthStart, { weekStartsOn: WEEK_STARTS_ON }), i))

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-card">
      <table className="w-full table-fixed border-collapse">
        <caption className="sr-only">{format(monthStart, "MMMM yyyy")}: your leave and company holidays</caption>
        <thead>
          <tr className="border-b bg-muted/60">
            {weekdayLabels.map((day) => (
              <th key={day.toISOString()} scope="col" className="py-2 text-center text-xs font-medium text-muted-foreground">
                <abbr title={format(day, "EEEE")} className="no-underline">
                  <span className="sm:hidden">{format(day, "EEEEE")}</span>
                  <span className="hidden sm:inline">{format(day, "EEE")}</span>
                </abbr>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week[0].toISOString()} className="border-b last:border-b-0">
              {week.map((day) => {
                const iso = format(day, "yyyy-MM-dd")
                const inMonth = isSameMonth(day, monthStart)
                const dayHolidays = holidays.filter((h) => h.holiday_date === iso)
                const dayLeave = leave.filter((l) => l.start_date <= iso && l.end_date >= iso)
                const isWeekend = weekendDays.includes(day.getDay())
                const isToday = iso === today
                const labels = [
                  ...dayHolidays.map((h) => `${h.name}${h.is_optional ? " (optional holiday)" : " (holiday)"}`),
                  ...dayLeave.map((l) => `${l.leave_type}, ${l.status}`),
                ]
                return (
                  <td
                    key={iso}
                    className={cn(
                      "h-16 border-r p-1 align-top last:border-r-0 sm:h-24 sm:p-1.5",
                      !inMonth && "bg-muted/30",
                      isWeekend && inMonth && "bg-muted/40"
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-6 items-center justify-center rounded-full text-xs tabular-nums sm:size-7 sm:text-sm",
                        !inMonth && "text-muted-foreground/60",
                        isToday && "bg-primary font-semibold text-primary-foreground"
                      )}
                    >
                      {format(day, "d")}
                      {isToday && <span className="sr-only"> (today)</span>}
                    </span>
                    {labels.length > 0 && <span className="sr-only">: {labels.join("; ")}</span>}
                    <div className="mt-1 space-y-0.5" aria-hidden>
                      {dayHolidays.map((h) => (
                        <div key={h.id} className="flex items-center gap-1">
                          <span className="size-1.5 shrink-0 rounded-full bg-brand sm:hidden" />
                          <span className="hidden truncate rounded bg-info-soft px-1 text-[0.7rem] text-info sm:block">{h.name}</span>
                        </div>
                      ))}
                      {dayLeave.map((l) => (
                        <div key={l.id} className="flex items-center gap-1">
                          <span className={cn("size-1.5 shrink-0 rounded-full sm:hidden", l.status === "approved" ? "bg-success" : "bg-warning")} />
                          <span
                            className={cn(
                              "hidden truncate rounded px-1 text-[0.7rem] sm:block",
                              l.status === "approved" ? "bg-success-soft text-success" : "bg-warning-soft text-warning"
                            )}
                          >
                            {l.leave_type}
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export function CalendarLegend() {
  const items = [
    { className: "bg-brand", label: "Holiday" },
    { className: "bg-success", label: "Approved leave" },
    { className: "bg-warning", label: "Pending leave" },
  ]
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground" aria-label="Legend">
      {items.map((item) => (
        <li key={item.label} className="flex items-center gap-1.5">
          <span className={cn("size-2 rounded-full", item.className)} aria-hidden />
          {item.label}
        </li>
      ))}
    </ul>
  )
}
