import { FileText } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { documentPeriod } from "@/components/admin/payroll-document-table"
import { PAYROLL_TABS } from "@/components/admin/payroll-list-page"
import { PayrollUploadForm } from "@/components/admin/payroll-upload-form"
import { EmptyState } from "@/components/shared/empty-state"
import { LinkTabs } from "@/components/shared/link-tabs"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { getSettings } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"
import { formatDateTime, todayIn } from "@/lib/utils/format"
import { flattenParams } from "@/lib/utils/params"
import { DOCUMENT_KINDS, type DocumentKind, isDocumentKind } from "@/lib/validations/payroll"

export const metadata: Metadata = { title: "Payroll" }

type Recent = {
  id: string
  kind: DocumentKind
  year: number
  month?: number
  created_at: string
  employee: { id: string; first_name: string; last_name: string } | null
}

export default async function PayrollPage({ searchParams }: PageProps<"/admin/payroll">) {
  const params = flattenParams(await searchParams)
  const settings = await getSettings()
  const today = todayIn(settings.timezone)
  const defaultKind = params.kind && isDocumentKind(params.kind) ? params.kind : "payslips"

  const supabase = await createClient()
  const fields = "id, year, created_at, employee:employees(id, first_name, last_name)"
  const [payslips, ytd, pf, preset] = await Promise.all([
    supabase.from("payslips").select(`${fields}, month`).order("created_at", { ascending: false }).limit(8),
    supabase.from("ytd_reports").select(fields).order("created_at", { ascending: false }).limit(8),
    supabase.from("pf_ytd_reports").select(fields).order("created_at", { ascending: false }).limit(8),
    params.employee
      ? supabase.from("employees").select("id, first_name, last_name, employee_code").eq("id", params.employee).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
  ])
  for (const result of [payslips, ytd, pf]) if (result.error) throw result.error

  const recent: Recent[] = [
    ...(payslips.data ?? []).map((d) => ({ ...d, kind: "payslips" as const })),
    ...(ytd.data ?? []).map((d) => ({ ...d, kind: "ytd" as const })),
    ...(pf.data ?? []).map((d) => ({ ...d, kind: "pf-ytd" as const })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8) as Recent[]

  return (
    <>
      <PageHeader title="Payroll" description="Upload payslips, YTD reports and PF YTD reports. Files are private to each employee." />
      <LinkTabs label="Payroll sections" active="overview" tabs={PAYROLL_TABS} />

      <div className="grid gap-8 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <section aria-labelledby="upload-heading" className="rounded-xl border bg-card p-5 shadow-card sm:p-6">
          <h2 id="upload-heading" className="mb-5 text-base font-semibold">
            Upload a document
          </h2>
          <PayrollUploadForm
            currentYear={Number(today.slice(0, 4))}
            currentMonth={Number(today.slice(5, 7))}
            defaultKind={defaultKind}
            defaultEmployee={
              preset.data
                ? { id: preset.data.id, label: `${preset.data.first_name} ${preset.data.last_name}`, code: preset.data.employee_code }
                : undefined
            }
          />
        </section>

        <section aria-labelledby="recent-heading">
          <SectionHeader title={<span id="recent-heading">Recent uploads</span>} />
          {recent.length ? (
            <ul className="divide-y rounded-xl border bg-card shadow-card">
              {recent.map((doc) => (
                <li key={`${doc.kind}-${doc.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <Link href={`/admin/employees/${doc.employee?.id}?tab=${doc.kind}`} className="block truncate text-sm font-medium hover:text-brand">
                      {doc.employee?.first_name} {doc.employee?.last_name}
                    </Link>
                    <p className="truncate text-xs text-muted-foreground">
                      {documentPeriod(doc.kind, doc.year, doc.month)} · {formatDateTime(doc.created_at, settings.timezone)}
                    </p>
                  </div>
                  <StatusBadge tone="brand">{DOCUMENT_KINDS[doc.kind].label}</StatusBadge>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState compact icon={FileText} title="No documents uploaded yet" description="Uploaded documents will appear here." />
          )}
        </section>
      </div>
    </>
  )
}
