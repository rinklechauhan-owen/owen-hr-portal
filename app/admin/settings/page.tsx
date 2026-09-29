import type { Metadata } from "next"

import { AdminUsers } from "@/components/admin/settings/admin-users"
import { AllocateLeaveButton } from "@/components/admin/settings/allocate-leave-button"
import { CompanySettingsForm } from "@/components/admin/settings/company-settings-form"
import { DepartmentManager } from "@/components/admin/settings/department-manager"
import { LeaveTypeDialog } from "@/components/admin/settings/leave-type-dialog"
import { DataTable } from "@/components/shared/data-table"
import { LinkTabs } from "@/components/shared/link-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { requireSession } from "@/lib/permissions"
import { getLeaveTypes, getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDays, todayIn } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Settings" }

const SECTIONS = [
  { value: "company", label: "Company Information" },
  { value: "leave-types", label: "Leave Types" },
  { value: "departments", label: "Departments" },
  { value: "admins", label: "Admin Users" },
] as const
type Section = (typeof SECTIONS)[number]["value"]

function Panel({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
      <div className="mb-5 space-y-1">
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>
      {children}
    </section>
  )
}

export default async function SettingsPage({ searchParams }: PageProps<"/admin/settings">) {
  const params = flattenParams(await searchParams)
  const section: Section = SECTIONS.some((s) => s.value === params.section) ? (params.section as Section) : "company"
  const session = await requireSession()
  const settings = await getSettings()
  const year = Number(todayIn(settings.timezone).slice(0, 4))

  return (
    <>
      <PageHeader title="Settings" description="Company details, leave rules and who can administer the portal." />
      <LinkTabs
        label="Settings sections"
        active={section}
        tabs={SECTIONS.map((s) => ({ value: s.value, label: s.label, href: `/admin/settings?section=${s.value}` }))}
      />
      <div className="max-w-4xl">
        {section === "company" && (
          <Panel title="Company information" description="Used across both portals and when counting leave days.">
            <CompanySettingsForm
              defaultValues={{
                company_name: settings.company_name,
                weekend_days: settings.weekend_days,
                max_backdate_days: settings.max_backdate_days,
                max_advance_days: settings.max_advance_days,
              }}
            />
          </Panel>
        )}
        {section === "leave-types" && <LeaveTypesSection year={year} />}
        {section === "departments" && <DepartmentsSection />}
        {section === "admins" && <AdminsSection currentUserId={session.userId} />}
      </div>
    </>
  )
}

async function LeaveTypesSection({ year }: { year: number }) {
  const leaveTypes = await getLeaveTypes()
  return (
    <Panel title="Leave types" description="The kinds of leave employees can request, and how many days each gets per year.">
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <AllocateLeaveButton year={year} />
        <AllocateLeaveButton year={year + 1} />
        <LeaveTypeDialog />
      </div>
      <DataTable
        caption="Leave types"
        rows={leaveTypes}
        rowKey={(t) => t.id}
        columns={[
          {
            header: "Name",
            cell: (t) => (
              <div className="whitespace-normal">
                <span className="block font-medium">{t.name}</span>
                {t.description && <span className="block text-xs text-muted-foreground">{t.description}</span>}
              </div>
            ),
          },
          { header: "Default", cell: (t) => (t.requires_balance ? formatDays(t.default_days) : "No balance") },
          {
            header: "Status",
            cell: (t) => (t.is_active ? <StatusBadge tone="success">Active</StatusBadge> : <StatusBadge>Inactive</StatusBadge>),
          },
          {
            header: "Edit",
            srOnlyHeader: true,
            className: "w-20 text-right",
            cell: (t) => (
              <LeaveTypeDialog
                leaveType={{
                  id: t.id,
                  name: t.name,
                  description: t.description ?? "",
                  default_days: Number(t.default_days),
                  requires_balance: t.requires_balance,
                  is_active: t.is_active,
                }}
              />
            ),
          },
        ]}
      />
    </Panel>
  )
}

async function DepartmentsSection() {
  const supabase = await createClient()
  const { data, error } = await supabase.from("departments").select("id, name, employees(count)").order("name")
  if (error) throw error
  const departments = (data ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    employees: (d.employees as unknown as { count: number }[])[0]?.count ?? 0,
  }))
  return (
    <Panel title="Departments" description="Group employees for filtering and reports.">
      <DepartmentManager departments={departments} />
    </Panel>
  )
}

async function AdminsSection({ currentUserId }: { currentUserId: string }) {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, is_active, employee:employees(id)")
    .eq("role", "admin")
    .order("full_name")
  if (error) throw error
  const admins = (data ?? []).map((p) => ({
    id: p.id,
    full_name: p.full_name,
    email: p.email,
    is_active: p.is_active,
    hasEmployeeRecord: Boolean(p.employee),
  }))
  return (
    <Panel title="Admin users" description="People who can use the Admin Portal. You cannot change your own access.">
      <AdminUsers admins={admins} currentUserId={currentUserId} />
    </Panel>
  )
}
