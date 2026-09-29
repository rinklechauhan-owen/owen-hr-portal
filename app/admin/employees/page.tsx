import { ChevronRight, Plus, Users } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { DataTable } from "@/components/shared/data-table"
import { EmptyState } from "@/components/shared/empty-state"
import { FilterDropdown } from "@/components/shared/filter-dropdown"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { SearchInput } from "@/components/shared/search-input"
import { EmployeeStatusBadge, StatusBadge } from "@/components/shared/status-badge"
import { buttonVariants } from "@/components/ui/button"
import { getDepartments } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"
import { searchFilters } from "@/lib/utils/search"
import { employeeFiltersSchema } from "@/lib/validations/employee"

export const metadata: Metadata = { title: "Employees" }

type Row = {
  id: string
  employee_code: string
  first_name: string
  last_name: string
  email: string
  designation: string | null
  joining_date: string
  status: "active" | "inactive"
  profile_id: string | null
  department: { name: string } | null
}

export default async function EmployeesPage({ searchParams }: PageProps<"/admin/employees">) {
  const params = flattenParams(await searchParams)
  const filters = employeeFiltersSchema.parse(params)
  const { from, to } = pageRange(filters.page)

  const supabase = await createClient()
  let query = supabase
    .from("employees")
    .select(
      "id, employee_code, first_name, last_name, email, designation, joining_date, status, profile_id, department:departments(name)",
      { count: "exact" }
    )
    .order("first_name")
    .order("last_name")
    .range(from, to)

  if (filters.status !== "all") query = query.eq("status", filters.status)
  if (filters.department) query = query.eq("department_id", filters.department)
  for (const filter of searchFilters(filters.q, ["first_name", "last_name", "email", "employee_code"])) {
    query = query.or(filter)
  }

  const [{ data, count, error }, departments] = await Promise.all([query, getDepartments()])
  if (error) throw error
  const rows = (data ?? []) as Row[]
  const isFiltered = Boolean(filters.q || filters.department || filters.status !== "active")

  return (
    <>
      <PageHeader
        title="Employees"
        description="Search, add and manage employee records and portal access."
        actions={
          <Link href="/admin/employees/new" className={buttonVariants()}>
            <Plus aria-hidden />
            Add employee
          </Link>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <SearchInput placeholder="Search name, ID or email" label="Search employees" />
        <FilterDropdown
          param="department"
          label="Department"
          allLabel="All departments"
          options={departments.map((d) => ({ value: d.id, label: d.name }))}
        />
        <FilterDropdown
          param="status"
          label="Status"
          allLabel="All statuses"
          defaultValue="active"
          options={[
            { value: "active", label: "Active" },
            { value: "inactive", label: "Disabled" },
          ]}
        />
      </div>

      <DataTable<Row>
        caption="Employees"
        rows={rows}
        rowKey={(row) => row.id}
        empty={
          <EmptyState
            icon={Users}
            title={isFiltered ? "No employees match your filters" : "No employees yet"}
            description={isFiltered ? "Try a different search or clear the filters." : "Add your first employee to get started."}
            action={
              !isFiltered && (
                <Link href="/admin/employees/new" className={buttonVariants()}>
                  <Plus aria-hidden />
                  Add employee
                </Link>
              )
            }
          />
        }
        columns={[
          {
            header: "Employee",
            cell: (row) => (
              <Link href={`/admin/employees/${row.id}`} className="group block rounded-md">
                <span className="block font-medium text-foreground group-hover:text-brand">
                  {row.first_name} {row.last_name}
                </span>
                <span className="block text-xs text-muted-foreground">{row.email}</span>
              </Link>
            ),
          },
          { header: "Employee ID", cell: (row) => <span className="font-mono text-xs">{row.employee_code}</span> },
          {
            header: "Department",
            cell: (row) => (
              <div>
                <span className="block">{row.department?.name ?? "—"}</span>
                {row.designation && <span className="block text-xs text-muted-foreground">{row.designation}</span>}
              </div>
            ),
          },
          { header: "Joined", cell: (row) => formatDate(row.joining_date) },
          {
            header: "Status",
            cell: (row) => (
              <div className="flex flex-wrap gap-1.5">
                <EmployeeStatusBadge status={row.status} />
                {!row.profile_id && row.status === "active" && <StatusBadge tone="warning">No login</StatusBadge>}
              </div>
            ),
          },
          {
            header: "Open",
            srOnlyHeader: true,
            className: "w-10",
            cell: (row) => (
              <Link
                href={`/admin/employees/${row.id}`}
                className="flex size-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
                aria-label={`Open ${row.first_name} ${row.last_name}`}
              >
                <ChevronRight className="size-4" aria-hidden />
              </Link>
            ),
          },
        ]}
        mobileCard={(row) => (
          <Link
            href={`/admin/employees/${row.id}`}
            className="flex items-center gap-3 rounded-xl border bg-card p-4 shadow-card"
          >
            <div className="min-w-0 flex-1 space-y-1">
              <p className="font-medium">
                {row.first_name} {row.last_name}
              </p>
              <p className="truncate text-sm text-muted-foreground">
                {row.employee_code} · {row.department?.name ?? "No department"}
              </p>
              <div className="flex flex-wrap gap-1.5 pt-1">
                <EmployeeStatusBadge status={row.status} />
                {!row.profile_id && row.status === "active" && <StatusBadge tone="warning">No login</StatusBadge>}
              </div>
            </div>
            <ChevronRight className="size-4 text-muted-foreground" aria-hidden />
          </Link>
        )}
      />

      <Pagination basePath="/admin/employees" params={params} page={filters.page} total={count ?? 0} />
    </>
  )
}
