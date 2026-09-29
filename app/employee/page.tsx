import { PageHeader } from "@/components/shared/page-header"
import { requireEmployee } from "@/lib/permissions"
import { greetingFor } from "@/lib/utils/format"

export default async function EmployeeDashboardPage() {
  const session = await requireEmployee()
  return <PageHeader title={`${greetingFor()}, ${session.employee.first_name}`} description="Your employee portal." />
}
