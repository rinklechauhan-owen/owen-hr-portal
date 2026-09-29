import { PartyPopper } from "lucide-react"
import type { Metadata } from "next"

import { EmptyState } from "@/components/shared/empty-state"
import { type Holiday, HolidayCard } from "@/components/shared/holiday-card"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { YearSwitcher } from "@/components/shared/year-switcher"
import { requireEmployee } from "@/lib/permissions"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDate, todayIn } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Holidays" }

export default async function EmployeeHolidaysPage({ searchParams }: PageProps<"/employee/holidays">) {
  await requireEmployee()
  const params = flattenParams(await searchParams)
  const settings = await getSettings()
  const today = todayIn(settings.timezone)
  const requested = Number(params.year)
  const year = requested >= 2000 && requested <= 2100 ? requested : Number(today.slice(0, 4))

  const supabase = await createClient()
  const { data, error } = await supabase
    .from("holidays")
    .select("id, name, holiday_date, description, is_optional")
    .gte("holiday_date", `${year}-01-01`)
    .lte("holiday_date", `${year}-12-31`)
    .order("holiday_date")
  if (error) throw error
  const holidays = (data ?? []) as Holiday[]
  const upcoming = holidays.filter((h) => h.holiday_date >= today)
  const next = upcoming[0]

  // Group by month for scanning.
  const byMonth = new Map<string, Holiday[]>()
  for (const holiday of holidays) {
    const key = holiday.holiday_date.slice(0, 7)
    byMonth.set(key, [...(byMonth.get(key) ?? []), holiday])
  }

  return (
    <>
      <PageHeader
        title="Holidays"
        description={`Company holidays for ${year}.`}
        backHref="/employee/calendar"
        backLabel="Calendar"
        actions={<YearSwitcher year={year} hrefFor={(y) => `/employee/holidays?year=${y}`} />}
      />

      {next && (
        <section aria-label="Next holiday" className="mb-6 rounded-xl bg-primary p-5 text-primary-foreground shadow-card">
          <p className="text-sm text-primary-foreground/75">Next holiday</p>
          <p className="mt-1 text-xl font-semibold">{next.name}</p>
          <p className="text-sm text-primary-foreground/85">
            {formatDate(next.holiday_date, "EEEE, d MMMM")}
            {next.is_optional && " · Optional"}
          </p>
        </section>
      )}

      {holidays.length === 0 ? (
        <EmptyState icon={PartyPopper} title={`No holidays published for ${year}`} description="HR will publish the holiday calendar here." />
      ) : (
        <div className="space-y-6">
          {[...byMonth.entries()].map(([monthKey, list]) => (
            <section key={monthKey} aria-labelledby={`m-${monthKey}`}>
              <SectionHeader title={<span id={`m-${monthKey}`}>{formatDate(`${monthKey}-01`, "MMMM")}</span>} />
              <div className="grid gap-3 md:grid-cols-2">
                {list.map((holiday) => (
                  <HolidayCard key={holiday.id} holiday={holiday} past={holiday.holiday_date < today} />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </>
  )
}
