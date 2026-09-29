import type { Metadata } from "next"

import { EmployeeForm } from "@/components/forms/employee-form"
import { PageHeader } from "@/components/shared/page-header"
import { getDepartments } from "@/lib/queries/reference"

export const metadata: Metadata = { title: "Add employee" }

export default async function NewEmployeePage() {
  const departments = await getDepartments()
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Add employee"
        description="Create the HR record first. You can give them portal access from their profile afterwards."
        backHref="/admin/employees"
        backLabel="Employees"
      />
      <EmployeeForm departments={departments} />
    </div>
  )
}
