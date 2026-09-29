import { History } from "lucide-react"
import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { ActivityList, type ActivityEntry } from "@/components/admin/activity-list"
import { EmployeeActions } from "@/components/admin/employee-actions"
import { DetailList } from "@/components/shared/detail-list"
import { EmptyState } from "@/components/shared/empty-state"
import { LinkTabs } from "@/components/shared/link-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { EmployeeStatusBadge, StatusBadge } from "@/components/shared/status-badge"
import { requireSession } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { formatDate } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Employee" }

const TABS = [
  { value: "overview", label: "Overview" },
  { value: "activity", label: "Activity" },
] as const
type Tab = (typeof TABS)[number]["value"]

export default async function EmployeeDetailPage({ params, searchParams }: PageProps<"/admin/employees/[id]">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()
  const query = flattenParams(await searchParams)
  const tab: Tab = TABS.some((t) => t.value === query.tab) ? (query.tab as Tab) : "overview"
  const page = Math.max(1, Number(query.page) || 1)

  const session = await requireSession()
  const supabase = await createClient()
  const { data: employee, error } = await supabase
    .from("employees")
    .select("*, department:departments(name), profile:profiles(role, is_active)")
    .eq("id", id)
    .maybeSingle()
  if (error) throw error
  if (!employee) notFound()

  const name = `${employee.first_name} ${employee.last_name}`
  const base = `/admin/employees/${id}`

  return (
    <>
      <PageHeader
        backHref="/admin/employees"
        backLabel="Employees"
        title={
          <span className="flex flex-wrap items-center gap-3">
            {name}
            <EmployeeStatusBadge status={employee.status} />
            {employee.profile?.role === "admin" && <StatusBadge tone="brand">Admin</StatusBadge>}
          </span>
        }
        description={[employee.designation, employee.department?.name].filter(Boolean).join(" · ") || employee.email}
        actions={
          <EmployeeActions
            employeeId={id}
            name={name}
            email={employee.email}
            status={employee.status}
            hasLogin={Boolean(employee.profile_id)}
            isSelf={employee.profile_id === session.userId}
          />
        }
      />

      <LinkTabs
        label="Employee sections"
        active={tab}
        tabs={TABS.map((t) => ({ value: t.value, label: t.label, href: t.value === "overview" ? base : `${base}?tab=${t.value}` }))}
      />

      {tab === "overview" && (
        <section aria-labelledby="info-heading" className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
          <h2 id="info-heading" className="mb-5 text-base font-semibold">
            Employee information
          </h2>
          <DetailList
            items={[
              { label: "Name", value: name },
              { label: "Employee ID", value: <span className="font-mono">{employee.employee_code}</span> },
              { label: "Email", value: employee.email },
              { label: "Phone", value: employee.phone },
              { label: "Department", value: employee.department?.name },
              { label: "Designation", value: employee.designation },
              { label: "Joining date", value: formatDate(employee.joining_date) },
              { label: "Status", value: employee.status === "active" ? "Active" : "Disabled" },
              {
                label: "Portal access",
                value: employee.profile_id
                  ? employee.profile?.is_active
                    ? "Can sign in"
                    : "Blocked"
                  : "Not invited yet",
              },
            ]}
          />
        </section>
      )}

      {tab === "activity" && <EmployeeActivity employeeId={id} page={page} basePath={base} />}
    </>
  )
}

async function EmployeeActivity({ employeeId, page, basePath }: { employeeId: string; page: number; basePath: string }) {
  const supabase = await createClient()
  const { from, to } = pageRange(page)
  const { data, count, error } = await supabase
    .from("audit_logs")
    .select("id, action, metadata, created_at, actor:profiles(full_name, email)", { count: "exact" })
    .eq("subject_employee_id", employeeId)
    .order("created_at", { ascending: false })
    .range(from, to)
  if (error) throw error

  if (!data?.length) {
    return <EmptyState icon={History} title="No activity yet" description="Changes to this employee will appear here." />
  }
  return (
    <>
      <ActivityList entries={data as ActivityEntry[]} />
      <Pagination basePath={basePath} params={{ tab: "activity" }} page={page} total={count ?? 0} />
    </>
  )
}
