import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { z } from "zod"

import { EmployeeForm } from "@/components/forms/employee-form"
import { PageHeader } from "@/components/shared/page-header"
import { getDepartments } from "@/lib/queries/reference"
import { createClient } from "@/lib/supabase/server"

export const metadata: Metadata = { title: "Edit employee" }

export default async function EditEmployeePage({ params }: PageProps<"/admin/employees/[id]/edit">) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const supabase = await createClient()
  const [{ data: employee, error }, departments] = await Promise.all([
    supabase
      .from("employees")
      .select("employee_code, first_name, last_name, email, phone, department_id, designation, joining_date")
      .eq("id", id)
      .maybeSingle(),
    getDepartments(),
  ])
  if (error) throw error
  if (!employee) notFound()

  return (
    <div className="max-w-3xl">
      <PageHeader
        title={`Edit ${employee.first_name} ${employee.last_name}`}
        backHref={`/admin/employees/${id}`}
        backLabel="Employee"
      />
      <EmployeeForm
        employeeId={id}
        departments={departments}
        defaultValues={{
          employee_code: employee.employee_code,
          first_name: employee.first_name,
          last_name: employee.last_name,
          email: employee.email,
          phone: employee.phone ?? "",
          department_id: employee.department_id ?? "",
          designation: employee.designation ?? "",
          joining_date: employee.joining_date,
        }}
      />
    </div>
  )
}
