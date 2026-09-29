import type { Metadata } from "next"

import { SalaryListPage } from "@/components/employee/salary-list-page"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "PF YTD Reports" }

export default async function Page({ searchParams }: PageProps<"/employee/salary/pf-ytd">) {
  return <SalaryListPage kind="pf-ytd" basePath="/employee/salary/pf-ytd" params={flattenParams(await searchParams)} />
}
