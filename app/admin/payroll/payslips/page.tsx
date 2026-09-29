import type { Metadata } from "next"

import { PayrollListPage } from "@/components/admin/payroll-list-page"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Payslips" }

export default async function Page({ searchParams }: PageProps<"/admin/payroll/payslips">) {
  return <PayrollListPage kind="payslips" params={flattenParams(await searchParams)} />
}
