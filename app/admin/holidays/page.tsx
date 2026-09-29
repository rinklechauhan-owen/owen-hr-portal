import { PartyPopper } from "lucide-react"
import type { Metadata } from "next"

import { DeleteHolidayButton } from "@/components/admin/delete-holiday-button"
import { HolidayDialog } from "@/components/admin/holiday-dialog"
import { DataTable } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { type Holiday, HolidayCard } from "@/components/shared/holiday-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { YearSwitcher } from "@/components/shared/year-switcher"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDate, todayIn } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Holidays" }

export default async function AdminHolidaysPage({ searchParams }: PageProps<"/admin/holidays">) {
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

  const actions = (holiday: Holiday) => (
    <div className="flex items-center justify-end gap-1">
      <HolidayDialog holiday={{ ...holiday, description: holiday.description ?? "" }} />
      <DeleteHolidayButton id={holiday.id} name={holiday.name} />
    </div>
  )

  return (
    <>
      <PageHeader
        title="Holidays"
        description={`${holidays.length} holiday${holidays.length === 1 ? "" : "s"} in ${year}. Employees see these in their calendar.`}
        actions={
          <>
            <YearSwitcher year={year} hrefFor={(y) => `/admin/holidays?year=${y}`} />
            <HolidayDialog />
          </>
        }
      />
      <DataTable<Holiday>
        caption={`Holidays in ${year}`}
        rows={holidays}
        rowKey={(h) => h.id}
        empty={
          <EmptyState icon={PartyPopper} title={`No holidays for ${year}`} description="Add the company holiday calendar so employees can plan ahead." action={<HolidayDialog />} />
        }
        columns={[
          {
            header: "Date",
            cell: (h) => (
              <span className={h.holiday_date < today ? "text-muted-foreground" : undefined}>
                {formatDate(h.holiday_date, "EEE, d MMM yyyy")}
              </span>
            ),
          },
          {
            header: "Holiday",
            cell: (h) => (
              <div className="whitespace-normal">
                <span className="block font-medium">{h.name}</span>
                {h.description && <span className="block text-xs text-muted-foreground">{h.description}</span>}
              </div>
            ),
          },
          { header: "Type", cell: (h) => (h.is_optional ? <StatusBadge>Optional</StatusBadge> : <StatusBadge tone="brand">Mandatory</StatusBadge>) },
          { header: "Actions", srOnlyHeader: true, className: "w-24", cell: actions },
        ]}
        mobileCard={(h) => <HolidayCard holiday={h} past={h.holiday_date < today} actions={actions(h)} />}
      />
    </>
  )
}

