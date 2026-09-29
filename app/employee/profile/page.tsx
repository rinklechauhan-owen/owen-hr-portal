import { Bell, KeyRound, LogOut } from "lucide-react"
import type { Metadata } from "next"
import Link from "next/link"

import { signOut } from "@/app/(auth)/actions"
import { PhoneForm } from "@/components/forms/phone-form"
import { DetailList } from "@/components/shared/detail-list"
import { PageHeader } from "@/components/shared/page-header"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"
import { requireEmployee } from "@/lib/permissions"
import { createClient } from "@/lib/supabase/server"
import { formatDate, initials } from "@/lib/utils/format"

export const metadata: Metadata = { title: "Profile" }

export default async function ProfilePage() {
  const session = await requireEmployee()
  const supabase = await createClient()
  const { data: employee, error } = await supabase
    .from("employees")
    .select("employee_code, first_name, last_name, email, phone, designation, joining_date, department:departments(name)")
    .eq("id", session.employee.id)
    .single()
  if (error) throw error
  const name = `${employee.first_name} ${employee.last_name}`

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Profile" />

      <section aria-label="Your details" className="rounded-xl border bg-card shadow-card">
        <div className="flex items-center gap-4 border-b p-5">
          <Avatar className="size-14">
            <AvatarFallback className="bg-primary text-lg font-semibold text-primary-foreground">{initials(name)}</AvatarFallback>
          </Avatar>
          <div className="min-w-0">
            <h2 className="truncate text-lg font-semibold">{name}</h2>
            <p className="truncate text-sm text-muted-foreground">
              {[employee.designation, employee.department?.name].filter(Boolean).join(" · ") || employee.email}
            </p>
          </div>
        </div>
        <div className="space-y-5 p-5">
          <DetailList
            items={[
              { label: "Employee ID", value: <span className="font-mono">{employee.employee_code}</span> },
              { label: "Email", value: employee.email },
              { label: "Department", value: employee.department?.name },
              { label: "Designation", value: employee.designation },
              { label: "Joining date", value: formatDate(employee.joining_date) },
            ]}
          />
          <div className="border-t pt-5">
            <PhoneForm phone={employee.phone} />
          </div>
          <p className="text-xs text-muted-foreground">
            To change your name, email, department or other details, please contact HR.
          </p>
        </div>
      </section>

      <section aria-label="Account" className="mt-6 divide-y rounded-xl border bg-card shadow-card">
        <Link href="/employee/notifications" className="flex items-center gap-3 px-5 py-4 text-sm font-medium hover:bg-muted/50">
          <Bell className="size-4 text-muted-foreground" aria-hidden />
          Notifications
        </Link>
        <Link href="/reset-password" className="flex items-center gap-3 px-5 py-4 text-sm font-medium hover:bg-muted/50">
          <KeyRound className="size-4 text-muted-foreground" aria-hidden />
          Change password
        </Link>
        <form action={signOut}>
          <Button type="submit" variant="ghost" className="h-auto w-full justify-start gap-3 rounded-none px-5 py-4 text-destructive hover:text-destructive">
            <LogOut className="size-4" aria-hidden />
            Log out
          </Button>
        </form>
      </section>
    </div>
  )
}
