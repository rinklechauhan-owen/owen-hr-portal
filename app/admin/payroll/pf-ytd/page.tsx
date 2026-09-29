import type { Metadata } from "next"

import { PayrollListPage } from "@/components/admin/payroll-list-page"
import { flattenParams } from "@/lib/utils/params"

export const metadata: Metadata = { title: "PF YTD Reports" }

export default async function Page({ searchParams }: PageProps<"/admin/payroll/pf-ytd">) {
  return <PayrollListPage kind="pf-ytd" params={flattenParams(await searchParams)} />
}
