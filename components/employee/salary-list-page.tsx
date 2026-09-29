import { loadMyDocuments, SalaryDocumentList } from "@/components/employee/salary-documents"
import { FilterDropdown } from "@/components/shared/filter-dropdown"
import { PageHeader } from "@/components/shared/page-header"
import { Pagination } from "@/components/shared/pagination"
import { requireEmployee } from "@/lib/permissions"
import { getSettings } from "@/lib/queries/reference"
import { financialYearLabel, todayIn } from "@/lib/utils/format"
import type { DocumentKind } from "@/lib/validations/payroll"

const PAGE_SIZE = 12

const TITLES: Record<DocumentKind, { title: string; description: string }> = {
  payslips: { title: "Payslips", description: "Monthly payslips, newest first." },
  ytd: { title: "YTD Reports", description: "Year-to-date salary reports by financial year (April to March)." },
  "pf-ytd": { title: "PF YTD Reports", description: "Provident Fund year-to-date reports by financial year." },
}

export async function SalaryListPage({ kind, basePath, params }: { kind: DocumentKind; basePath: string; params: Record<string, string | undefined> }) {
  await requireEmployee()
  const settings = await getSettings()
  const thisYear = Number(todayIn(settings.timezone).slice(0, 4))
  const page = Math.max(1, Number(params.page) || 1)
  const requestedYear = Number(params.year)
  const year = requestedYear >= 2000 && requestedYear <= 2100 ? requestedYear : undefined
  const { rows, count } = await loadMyDocuments(kind, { limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE, year })
  const years = Array.from({ length: 6 }, (_, i) => thisYear - i)

  return (
    <>
      <PageHeader
        title={TITLES[kind].title}
        description={TITLES[kind].description}
        backHref="/employee/salary"
        backLabel="Salary"
        actions={
          <FilterDropdown
            param="year"
            label="Year"
            allLabel="All years"
            options={years.map((y) => ({ value: String(y), label: kind === "payslips" ? String(y) : financialYearLabel(y) }))}
          />
        }
      />
      <SalaryDocumentList kind={kind} rows={rows} />
      <Pagination basePath={basePath} params={params} page={page} total={count} pageSize={PAGE_SIZE} />
    </>
  )
}
