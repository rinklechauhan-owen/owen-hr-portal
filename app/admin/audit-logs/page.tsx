import { ScrollText } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"
import { z } from "zod"

import { DataTable } from "@/components/shared/data-table"
import { DateRangeFilter } from "@/components/shared/date-range-filter"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterDropdown } from "@/components/shared/filter-dropdown"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { StatusBadge } from "@/components/shared/status-badge"
import { actionLabel, actionTone, AUDIT_ACTION_GROUPS, describeAuditMetadata } from "@/lib/audit"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { addDaysIso, formatDateTime } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"
import type { Json } from "@/types/database"

export const metadata: Metadata = { title: "Audit Logs" }

const PAGE_SIZE = 50
const AREAS = AUDIT_ACTION_GROUPS.map((g) => g.value) as [string, ...string[]]

const filtersSchema = z.object({
  area: z.enum(AREAS).optional().catch(undefined),
  from: z.iso.date().optional().catch(undefined),
  to: z.iso.date().optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
})

type Row = {
  id: number
  action: string
  metadata: Json
  created_at: string
  actor: { full_name: string; email: string } | null
  subject: { id: string; first_name: string; last_name: string } | null
}

const TONE_TO_BADGE = { neutral: "neutral", success: "success", danger: "danger", warning: "warning", info: "info" } as const

export default async function AuditLogsPage({ searchParams }: PageProps<"/admin/audit-logs">) {
  const params = flattenParams(await searchParams)
  const filters = filtersSchema.parse(params)
  const { from, to } = pageRange(filters.page, PAGE_SIZE)
  const settings = await getSettings()
  const supabase = await createClient()

  let query = supabase
    .from("audit_logs")
    .select("id, action, metadata, created_at, actor:profiles(full_name, email), subject:employees(id, first_name, last_name)", {
      count: "exact",
    })
    .order("created_at", { ascending: false })
    .range(from, to)
  if (filters.area) query = query.like("action", `${filters.area}.%`)
  // Dates are interpreted in the company time zone (IST is UTC+05:30).
  if (filters.from) query = query.gte("created_at", `${filters.from}T00:00:00+05:30`)
  if (filters.to) query = query.lt("created_at", `${addDaysIso(filters.to, 1)}T00:00:00+05:30`)

  const { data, count, error } = await query
  if (error) throw error
  const rows = (data ?? []) as unknown as Row[]

  return (
    <>
      <PageHeader title="Audit Logs" description="Who did what, and when. Entries cannot be edited or deleted." />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <FilterDropdown param="area" label="Area" allLabel="All activity" options={AUDIT_ACTION_GROUPS.map((g) => ({ value: g.value, label: g.label }))} />
        <DateRangeFilter />
      </div>
      <DataTable<Row>
        caption="Audit log"
        rows={rows}
        rowKey={(r) => String(r.id)}
        empty={<EmptyState icon={ScrollText} title="No activity found" description="Try a different area or date range." />}
        columns={[
          { header: "When", className: "whitespace-nowrap", cell: (r) => <span className="text-sm">{formatDateTime(r.created_at, settings.timezone)}</span> },
          { header: "Action", cell: (r) => <StatusBadge tone={TONE_TO_BADGE[actionTone(r.action)]}>{actionLabel(r.action)}</StatusBadge> },
          {
            header: "Details",
            className: "max-w-md",
            cell: (r) => <span className="block truncate text-sm text-muted-foreground">{describeAuditMetadata(r.action, r.metadata) ?? "—"}</span>,
          },
          {
            header: "Employee",
            cell: (r) =>
              r.subject ? (
                <Link href={`/admin/employees/${r.subject.id}?tab=activity`} className="text-sm hover:text-brand">
                  {r.subject.first_name} {r.subject.last_name}
                </Link>
              ) : (
                <span className="text-muted-foreground">—</span>
              ),
          },
          { header: "By", cell: (r) => <span className="text-sm">{r.actor ? r.actor.full_name || r.actor.email : "System"}</span> },
        ]}
        mobileCard={(r) => (
          <div className="space-y-1 rounded-xl border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between gap-2">
              <StatusBadge tone={TONE_TO_BADGE[actionTone(r.action)]}>{actionLabel(r.action)}</StatusBadge>
              <span className="text-xs text-muted-foreground">{formatDateTime(r.created_at, settings.timezone)}</span>
            </div>
            <p className="text-sm text-muted-foreground">{describeAuditMetadata(r.action, r.metadata) ?? "—"}</p>
            <p className="text-xs text-muted-foreground">By {r.actor ? r.actor.full_name || r.actor.email : "System"}</p>
          </div>
        )}
      />
      <Pagination basePath="/admin/audit-logs" params={params} page={filters.page} total={count ?? 0} pageSize={PAGE_SIZE} />
    </>
  )
}
