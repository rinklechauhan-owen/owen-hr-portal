import type { Metadata } from "next"

import { SalaryListPage } from "@/components/employee/salary-list-page"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "YTD Reports" }

export default async function Page({ searchParams }: PageProps<"/employee/salary/ytd">) {
  return <SalaryListPage kind="ytd" basePath="/employee/salary/ytd" params={flattenParams(await searchParams)} />
}
