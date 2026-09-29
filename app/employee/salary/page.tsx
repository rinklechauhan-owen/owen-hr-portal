import type { Metadata } from "next"
import Link from "next/link"

import { loadMyDocuments, SalaryDocumentList } from "@/components/employee/salary-documents"
import { PageHeader, SectionHeader } from "@/components/shared/page-header"
import { requireEmployee } from "@/lib/permissions"
import type { DocumentKind } from "@/lib/validations/payroll"

export const metadata: Metadata = { title: "Salary" }

const SECTIONS: { kind: DocumentKind; title: string; href: string }[] = [
  { kind: "payslips", title: "Payslips", href: "/employee/salary/payslips" },
  { kind: "ytd", title: "YTD Reports", href: "/employee/salary/ytd" },
  { kind: "pf-ytd", title: "PF Reports", href: "/employee/salary/pf-ytd" },
]

export default async function SalaryPage() {
  await requireEmployee()
  const results = await Promise.all(SECTIONS.map((s) => loadMyDocuments(s.kind, { limit: 3 })))

  return (
    <>
      <PageHeader title="Salary" description="Your payslips and year-to-date reports. Only you and HR can see these." />
      <div className="space-y-8">
        {SECTIONS.map((section, index) => (
          <section key={section.kind} aria-labelledby={`${section.kind}-heading`}>
            <SectionHeader
              title={<span id={`${section.kind}-heading`}>{section.title}</span>}
              action={
                results[index].count > 3 && (
                  <Link href={section.href} className="text-sm font-medium text-brand hover:underline">
                    View all {results[index].count}
                  </Link>
                )
              }
            />
            <SalaryDocumentList kind={section.kind} rows={results[index].rows} compact />
          </section>
        ))}
      </div>
    </>
  )
}
