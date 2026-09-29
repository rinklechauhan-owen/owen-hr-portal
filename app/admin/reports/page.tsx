import { CheckCircle2, Inbox, MinusCircle } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { DataTable } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterDropdown } from "@/components/shared/filter-dropdown"
import { LinkTabs } from "@/components/shared/link-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { StatCard } from "@/components/shared/stat-card"
import { YearSwitcher } from "@/components/shared/year-switcher"
import { getLeaveTypes, getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { financialYearLabel, financialYearOf, MONTHS, todayIn } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Reports" }

const REPORTS = [
  { value: "leave-summary", label: "Leave Summary" },
  { value: "usage", label: "Employee Leave Usage" },
  { value: "payroll", label: "Payroll Document Status" },
] as const
type Report = (typeof REPORTS)[number]["value"]

function num(value: number) {
  const n = Number(value)
  return Number.isInteger(n) ? n : n.toFixed(1)
}

export default async function ReportsPage({ searchParams }: PageProps<"/admin/reports">) {
  const params = flattenParams(await searchParams)
  const report: Report = REPORTS.some((r) => r.value === params.report) ? (params.report as Report) : "leave-summary"
  const settings = await getSettings()
  const today = todayIn(settings.timezone)
  const requestedYear = Number(params.year)
  const year = requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : Number(today.slice(0, 4))
  const page = Math.max(1, Number(params.page) || 1)
  const hrefFor = (y: number) => `/admin/reports?report=${report}&year=${y}`

  return (
    <>
      <PageHeader
        title="Reports"
        description="Simple summaries of leave and payroll documents."
        actions={report !== "payroll" && <YearSwitcher year={year} hrefFor={hrefFor} />}
      />
      <LinkTabs
        label="Reports"
        active={report}
        tabs={REPORTS.map((r) => ({ value: r.value, label: r.label, href: `/admin/reports?report=${r.value}&year=${year}` }))}
      />
      {report === "leave-summary" && <LeaveSummary year={year} />}
      {report === "usage" && <LeaveUsage year={year} page={page} />}
      {report === "payroll" && <PayrollStatus params={params} today={today} page={page} />}
    </>
  )
}

async function LeaveSummary({ year }: { year: number }) {
  const supabase = await createClient()
  const [summary, pending] = await Promise.all([
    supabase.rpc("report_leave_summary", { p_year: year }),
    supabase.from("leave_requests").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ])
  if (summary.error) throw summary.error
  const rows = summary.data ?? []
  const totals = rows.reduce(
    (acc, r) => ({ used: acc.used + Number(r.used_days), approved: acc.approved + r.approved_requests, rejected: acc.rejected + r.rejected_requests }),
    { used: 0, approved: 0, rejected: 0 }
  )

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={`Days taken in ${year}`} value={num(totals.used)} />
        <StatCard label="Approved requests" value={totals.approved} />
        <StatCard label="Rejected requests" value={totals.rejected} />
        <StatCard label="Pending now" value={pending.count ?? 0} icon={Inbox} href="/admin/leave" tone={(pending.count ?? 0) > 0 ? "attention" : "default"} />
      </div>
      <DataTable
        caption={`Leave summary for ${year}`}
        rows={rows}
        rowKey={(r) => r.leave_type_id}
        empty={<EmptyState title="No leave types" />}
        columns={[
          { header: "Leave type", cell: (r) => <span className="font-medium">{r.leave_type}</span> },
          { header: "Employees", className: "text-right tabular-nums", cell: (r) => (r.requires_balance ? r.employees : "—") },
          { header: "Allocated", className: "text-right tabular-nums", cell: (r) => (r.requires_balance ? num(r.allocated_days) : "—") },
          { header: "Used", className: "text-right tabular-nums", cell: (r) => num(r.used_days) },
          { header: "Pending", className: "text-right tabular-nums", cell: (r) => num(r.pending_days) },
          {
            header: "Utilisation",
            className: "w-40",
            cell: (r) => {
              const pct = r.requires_balance && Number(r.allocated_days) > 0 ? Math.round((Number(r.used_days) / Number(r.allocated_days)) * 100) : null
              return pct === null ? (
                <span className="text-muted-foreground">—</span>
              ) : (
                <div className="flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div className="h-full bg-primary" style={{ width: `${Math.min(pct, 100)}%` }} />
                  </div>
                  <span className="w-10 text-right text-xs tabular-nums">{pct}%</span>
                </div>
              )
            },
          },
          { header: "Approved", className: "text-right tabular-nums", cell: (r) => r.approved_requests },
          { header: "Rejected", className: "text-right tabular-nums", cell: (r) => r.rejected_requests },
        ]}
      />
    </div>
  )
}

async function LeaveUsage({ year, page }: { year: number; page: number }) {
  const supabase = await createClient()
  const { from, to } = pageRange(page)
  const [employees, leaveTypes] = await Promise.all([
    supabase
      .from("employees")
      .select("id, employee_code, first_name, last_name", { count: "exact" })
      .eq("status", "active")
      .order("first_name")
      .order("last_name")
      .range(from, to),
    getLeaveTypes({ activeOnly: true }),
  ])
  if (employees.error) throw employees.error
  const types = leaveTypes.filter((t) => t.requires_balance)
  const ids = (employees.data ?? []).map((e) => e.id)
  const balances = ids.length
    ? await supabase.from("leave_balance_summary").select("employee_id, leave_type_id, allocated_days, used_days, pending_days").eq("year", year).in("employee_id", ids)
    : { data: [], error: null }
  if (balances.error) throw balances.error
  const lookup = new Map((balances.data ?? []).map((b) => [`${b.employee_id}:${b.leave_type_id}`, b]))

  return (
    <>
      <DataTable
        caption={`Leave used per employee in ${year}`}
        rows={employees.data ?? []}
        rowKey={(e) => e.id}
        empty={<EmptyState title="No active employees" />}
        columns={[
          {
            header: "Employee",
            cell: (e) => (
              <Link href={`/admin/employees/${e.id}?tab=leave&year=${year}`} className="group block">
                <span className="block font-medium group-hover:text-brand">{e.first_name} {e.last_name}</span>
                <span className="block font-mono text-xs text-muted-foreground">{e.employee_code}</span>
              </Link>
            ),
          },
          ...types.map((type) => ({
            header: type.name,
            className: "text-right tabular-nums",
            cell: (e: { id: string }) => {
              const b = lookup.get(`${e.id}:${type.id}`)
              if (!b) return <span className="text-muted-foreground">—</span>
              return (
                <span>
                  <span className="font-medium">{num(b.used_days)}</span>
                  <span className="text-muted-foreground"> / {num(b.allocated_days)}</span>
                  {Number(b.pending_days) > 0 && <span className="block text-xs text-warning">{num(b.pending_days)} pending</span>}
                </span>
              )
            },
          })),
        ]}
      />
      <p className="mt-2 text-xs text-muted-foreground">Used / allocated days. A dash means no balance for that year.</p>
      <Pagination basePath="/admin/reports" params={{ report: "usage", year: String(year) }} page={page} total={employees.count ?? 0} />
    </>
  )
}

async function PayrollStatus({ params, today, page }: { params: Record<string, string | undefined>; today: string; page: number }) {
  const month = Number(params.month) >= 1 && Number(params.month) <= 12 ? Number(params.month) : Number(today.slice(5, 7))
  const year = Number(params.year) >= 2000 && Number(params.year) <= 2100 ? Number(params.year) : Number(today.slice(0, 4))
  const fy = financialYearOf(`${year}-${String(month).padStart(2, "0")}-01`)
  const pageSize = 25
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("report_payroll_status", {
    p_year: year,
    p_month: month,
    p_limit: pageSize,
    p_offset: (page - 1) * pageSize,
  })
  if (error) throw error
  const rows = data ?? []
  const total = Number(rows[0]?.total_count ?? 0)
  const years = Array.from({ length: 5 }, (_, i) => Number(today.slice(0, 4)) + 1 - i)
  const mark = (ok: boolean, label: string) =>
    ok ? (
      <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="size-4" aria-hidden /><span className="sr-only">{label} uploaded</span>Yes</span>
    ) : (
      <span className="inline-flex items-center gap-1 text-muted-foreground"><MinusCircle className="size-4" aria-hidden /><span className="sr-only">{label} missing</span>No</span>
    )

  return (
    <>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center">
        <FilterDropdown param="month" label="Month" allLabel="Current month" options={MONTHS.map((m, i) => ({ value: String(i + 1), label: m }))} />
        <FilterDropdown param="year" label="Year" allLabel="Current year" options={years.map((y) => ({ value: String(y), label: String(y) }))} />
        <p className="text-sm text-muted-foreground sm:ml-2">
          Payslip for {MONTHS[month - 1]} {year} · YTD and PF for {financialYearLabel(fy)}
        </p>
      </div>
      <DataTable
        caption="Payroll document status"
        rows={rows}
        rowKey={(r) => r.employee_id}
        empty={<EmptyState title="No active employees" />}
        columns={[
          {
            header: "Employee",
            cell: (r) => (
              <Link href={`/admin/employees/${r.employee_id}?tab=payslips`} className="group block">
                <span className="block font-medium group-hover:text-brand">{r.full_name}</span>
                <span className="block font-mono text-xs text-muted-foreground">{r.employee_code}</span>
              </Link>
            ),
          },
          { header: "Department", cell: (r) => r.department ?? "—" },
          { header: "Payslip", cell: (r) => mark(r.has_payslip, "Payslip") },
          { header: "YTD report", cell: (r) => mark(r.has_ytd_report, "YTD report") },
          { header: "PF YTD report", cell: (r) => mark(r.has_pf_ytd_report, "PF YTD report") },
          {
            header: "Upload",
            srOnlyHeader: true,
            cell: (r) =>
              !r.has_payslip && (
                <Link href={`/admin/payroll?employee=${r.employee_id}&kind=payslips`} className="text-sm font-medium text-brand hover:underline">
                  Upload payslip
                </Link>
              ),
          },
        ]}
      />
      <Pagination
        basePath="/admin/reports"
        params={{ report: "payroll", month: String(month), year: String(year) }}
        page={page}
        total={total}
        pageSize={pageSize}
      />
    </>
  )
}
