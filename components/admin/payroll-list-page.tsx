import Link from "next/link"
import { z } from "zod"

import { EmployeeFilter } from "@/components/admin/employee-combobox"
import { PayrollDocumentTable } from "@/components/admin/payroll-document-table"
import { FilterDropdown } from "@/components/shared/filter-dropdown"
import { LinkTabs } from "@/components/shared/link-tabs"
import { PageHeader } from "@/components/shared/page-header"
import { buttonVariants } from "@/components/ui/button"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { financialYearLabel, MONTHS, todayIn } from "@/lib/utils/format"
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/validations/payroll"

const filtersSchema = z.object({
  employee: z.uuid().optional().catch(undefined),
  year: z.coerce.number().int().min(2000).max(2100).optional().catch(undefined),
  month: z.coerce.number().int().min(1).max(12).optional().catch(undefined),
  page: z.coerce.number().int().min(1).catch(1),
})

export const PAYROLL_TABS = [
  { value: "overview", label: "Upload", href: "/admin/payroll" },
  { value: "payslips", label: "Payslips", href: "/admin/payroll/payslips" },
  { value: "ytd", label: "YTD Reports", href: "/admin/payroll/ytd" },
  { value: "pf-ytd", label: "PF YTD Reports", href: "/admin/payroll/pf-ytd" },
]

export async function PayrollListPage({ kind, params }: { kind: DocumentKind; params: Record<string, string | undefined> }) {
  const filters = filtersSchema.parse(params)
  const settings = await getSettings()
  const thisYear = Number(todayIn(settings.timezone).slice(0, 4))
  const hasMonth = DOCUMENT_KINDS[kind].hasMonth
  const years = Array.from({ length: 6 }, (_, i) => thisYear + 1 - i)
  const basePath = PAYROLL_TABS.find((t) => t.value === kind)!.href

  const supabase = await createClient()
  const selected = filters.employee
    ? (await supabase.from("employees").select("first_name, last_name").eq("id", filters.employee).maybeSingle()).data
    : null

  return (
    <>
      <PageHeader
        title="Payroll"
        description="Payslips, YTD reports and PF YTD reports, stored privately for each employee."
        actions={
          <Link href={`/admin/payroll?kind=${kind}`} className={buttonVariants()}>
            Upload {DOCUMENT_KINDS[kind].label.toLowerCase()}
          </Link>
        }
      />
      <LinkTabs label="Payroll sections" active={kind} tabs={PAYROLL_TABS} />
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
        <EmployeeFilter selectedLabel={selected ? `${selected.first_name} ${selected.last_name}` : null} />
        <FilterDropdown
          param="year"
          label={hasMonth ? "Year" : "Financial year"}
          allLabel={hasMonth ? "All years" : "All financial years"}
          options={years.map((y) => ({ value: String(y), label: hasMonth ? String(y) : financialYearLabel(y) }))}
        />
        {hasMonth && (
          <FilterDropdown
            param="month"
            label="Month"
            allLabel="All months"
            options={MONTHS.map((name, i) => ({ value: String(i + 1), label: name }))}
          />
        )}
      </div>
      <PayrollDocumentTable
        kind={kind}
        employeeId={filters.employee}
        year={filters.year}
        month={filters.month}
        page={filters.page}
        basePath={basePath}
        params={params}
      />
    </>
  )
}
