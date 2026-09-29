import { FileText } from "lucide-react"

import { DocumentCard } from "@/components/shared/document-card"
import { EmptyState } from "@/components/shared/empty-state"
import { tableFor } from "@/lib/payroll"
import { createClient } from "@/lib/supabase/server"
import { financialYearLabel, formatDate, payslipPeriod } from "@/lib/utils/format"
import type { DocumentKind } from "@/lib/validations/payroll"

type Row = { id: string; year: number; month?: number; created_at: string }

const EMPTY: Record<DocumentKind, { title: string; description: string }> = {
  payslips: { title: "No Payslips Available", description: "Your payslips will appear here once HR uploads them." },
  ytd: { title: "No YTD Reports Available", description: "Your year-to-date reports will appear here once HR uploads them." },
  "pf-ytd": { title: "No PF Reports Available", description: "Your PF year-to-date reports will appear here once HR uploads them." },
}

function titleFor(kind: DocumentKind, row: Row) {
  if (kind === "payslips" && row.month) return payslipPeriod(row.year, row.month)
  return `${financialYearLabel(row.year)} ${kind === "ytd" ? "YTD Report" : "PF YTD"}`
}

/**
 * The signed-in employee's documents of one kind. The query has no employee
 * filter on purpose: RLS returns only the caller's own rows.
 */
export async function loadMyDocuments(kind: DocumentKind, options: { limit: number; offset?: number; year?: number }) {
  const supabase = await createClient()
  const hasMonth = kind === "payslips"
  let query = supabase
    .from(tableFor(kind))
    .select(`id, year, ${hasMonth ? "month, " : ""}created_at`, { count: "exact" })
    .order("year", { ascending: false })
    .range(options.offset ?? 0, (options.offset ?? 0) + options.limit - 1)
  if (hasMonth) query = query.order("month", { ascending: false })
  if (options.year) query = query.eq("year", options.year)
  const { data, count, error } = await query
  if (error) throw error
  return { rows: (data ?? []) as unknown as Row[], count: count ?? 0 }
}

export function SalaryDocumentList({ kind, rows, compact = false }: { kind: DocumentKind; rows: Row[]; compact?: boolean }) {
  if (rows.length === 0) {
    return <EmptyState compact={compact} icon={FileText} title={EMPTY[kind].title} description={EMPTY[kind].description} />
  }
  return (
    <ul className="space-y-2.5">
      {rows.map((row) => (
        <li key={row.id}>
          <DocumentCard kind={kind} id={row.id} title={titleFor(kind, row)} subtitle={`Added ${formatDate(row.created_at.slice(0, 10))}`} />
        </li>
      ))}
    </ul>
  )
}
