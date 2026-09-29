import type { Metadata } from "next"

import { SalaryListPage } from "@/components/employee/salary-list-page"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "Payslips" }

export default async function Page({ searchParams }: PageProps<"/employee/salary/payslips">) {
  return <SalaryListPage kind="payslips" basePath="/employee/salary/payslips" params={flattenParams(await searchParams)} />
}
