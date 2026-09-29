import { FileText } from "lucide-react"
import Link from "next/link"

import { DeleteDocumentButton } from "@/components/admin/delete-document-button"
import { DataTable } from "@/components/shared/data-table"
import { DocumentActions, DocumentCard } from "@/components/shared/document-card"
import { EmptyState } from "@/components/shared/empty-state"
import { Pagination, pageRange } from "@/components/shared/pagination"
import { tableFor } from "@/lib/payroll"
import { createClient } from "@/lib/supabase/server"
import { financialYearLabel, formatDate, formatFileSize, payslipPeriod } from "@/lib/utils/format"
import { DOCUMENT_KINDS, type DocumentKind } from "@/lib/validations/payroll"

type Row = {
  id: string
  year: number
  month?: number
  file_name: string
  file_size: number
  created_at: string
  employee: { id: string; first_name: string; last_name: string; employee_code: string } | null
  uploader: { full_name: string; email: string } | null
}

export function documentPeriod(kind: DocumentKind, year: number, month?: number | null) {
  return kind === "payslips" && month ? payslipPeriod(year, month) : financialYearLabel(year)
}

/** Admin list of one payroll document kind, with filters applied on the server. */
export async function PayrollDocumentTable({
  kind,
  employeeId,
  year,
  month,
  page,
  basePath,
  params,
  showEmployee = true,
}: {
  kind: DocumentKind
  employeeId?: string
  year?: number
  month?: number
  page: number
  basePath: string
  params: Record<string, string | undefined>
  showEmployee?: boolean
}) {
  const supabase = await createClient()
  const { from, to } = pageRange(page)
  const hasMonth = DOCUMENT_KINDS[kind].hasMonth

  let query = supabase
    .from(tableFor(kind))
    .select(
      `id, year, ${hasMonth ? "month, " : ""}file_name, file_size, created_at, employee:employees(id, first_name, last_name, employee_code), uploader:profiles(full_name, email)`,
      { count: "exact" }
    )
    .order("year", { ascending: false })
    .range(from, to)
  if (hasMonth) query = query.order("month", { ascending: false })
  if (employeeId) query = query.eq("employee_id", employeeId)
  if (year) query = query.eq("year", year)
  // Only payslips have a month; `filter` avoids the column union type.
  if (hasMonth && month) query = query.filter("month", "eq", month)

  const { data, count, error } = await query
  if (error) throw error
  const rows = (data ?? []) as unknown as Row[]
  const label = DOCUMENT_KINDS[kind]
  const title = (row: Row) =>
    `${label.label} ${documentPeriod(kind, row.year, row.month)}${showEmployee && row.employee ? ` for ${row.employee.first_name} ${row.employee.last_name}` : ""}`

  return (
    <>
      <DataTable<Row>
        caption={label.plural}
        rows={rows}
        rowKey={(r) => r.id}
        empty={<EmptyState icon={FileText} title={`No ${label.plural.toLowerCase()} found`} description="Upload documents from the Payroll page." />}
        columns={[
          ...(showEmployee
            ? [
                {
                  header: "Employee",
                  cell: (r: Row) => (
                    <Link href={`/admin/employees/${r.employee?.id}`} className="group block">
                      <span className="block font-medium group-hover:text-brand">
                        {r.employee?.first_name} {r.employee?.last_name}
                      </span>
                      <span className="block font-mono text-xs text-muted-foreground">{r.employee?.employee_code}</span>
                    </Link>
                  ),
                },
              ]
            : []),
          { header: "Period", cell: (r) => <span className="font-medium">{documentPeriod(kind, r.year, r.month)}</span> },
          {
            header: "File",
            cell: (r) => (
              <span className="block max-w-56 truncate text-sm text-muted-foreground" title={r.file_name}>
                {r.file_name} · {formatFileSize(r.file_size)}
              </span>
            ),
          },
          {
            header: "Uploaded",
            cell: (r) => (
              <span className="text-sm">
                {formatDate(r.created_at.slice(0, 10))}
                {r.uploader && <span className="block text-xs text-muted-foreground">{r.uploader.full_name || r.uploader.email}</span>}
              </span>
            ),
          },
          {
            header: "Actions",
            srOnlyHeader: true,
            cell: (r) => (
              <div className="flex items-center justify-end gap-1">
                <DocumentActions kind={kind} id={r.id} title={title(r)} compact />
                <DeleteDocumentButton kind={kind} id={r.id} title={title(r)} />
              </div>
            ),
          },
        ]}
        mobileCard={(r) => (
          <DocumentCard
            kind={kind}
            id={r.id}
            title={showEmployee && r.employee ? `${r.employee.first_name} ${r.employee.last_name}` : documentPeriod(kind, r.year, r.month)}
            subtitle={showEmployee ? `${documentPeriod(kind, r.year, r.month)} · ${r.file_name}` : r.file_name}
          />
        )}
      />
      <Pagination basePath={basePath} params={params} page={page} total={count ?? 0} />
    </>
  )
}
