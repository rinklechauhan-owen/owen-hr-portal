import type { Metadata } from "next"

import { PayrollListPage } from "@/components/admin/payroll-list-page"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "YTD Reports" }

export default async function Page({ searchParams }: PageProps<"/admin/payroll/ytd">) {
  return <PayrollListPage kind="ytd" params={flattenParams(await searchParams)} />
}
