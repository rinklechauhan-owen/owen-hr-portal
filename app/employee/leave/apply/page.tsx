import type { Metadata } from "next"

import { ApplyLeaveForm, type LeaveTypeOption } from "@/components/forms/apply-leave-form"
import { EmptyState } from "@/components/shared/empty-state"
import { PageHeader } from "@/components/shared/page-header"
import { requireEmployee } from "@/lib/permissions"
import { getBalances } from "@/lib/queries/leave"
import { getLeaveTypes, getSettings } from "@/lib/queries/reference"
import { addDaysIso, todayIn } from "@/lib/utils/format"

export const metadata: Metadata = { title: "Apply for leave" }

export default async function ApplyLeavePage() {
  const session = await requireEmployee()
  const settings = await getSettings()
  const today = todayIn(settings.timezone)
  const year = Number(today.slice(0, 4))
  const minDate = addDaysIso(today, -settings.max_backdate_days)
  const maxDate = addDaysIso(today, settings.max_advance_days)

  // Balances for every year the allowed date window touches.
  const years = Array.from(new Set([minDate, today, maxDate].map((d) => Number(d.slice(0, 4)))))
  const [leaveTypes, ...balancesByYear] = await Promise.all([
    getLeaveTypes({ activeOnly: true }),
    ...years.map((y) => getBalances(session.employee.id, y)),
  ])
  const balances = balancesByYear.flat()

  const options: LeaveTypeOption[] = leaveTypes.map((type) => ({
    id: type.id,
    name: type.name,
    description: type.description,
    requires_balance: type.requires_balance,
    available: Object.fromEntries(
      years.map((y) => [
        y,
        Number(balances.find((b) => b.leave_type_id === type.id && b.year === y)?.available_days ?? 0),
      ])
    ),
  }))

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        title="Apply for leave"
        description="Your request goes to HR for approval."
        backHref="/employee/leave"
        backLabel="Leave"
      />
      {options.length ? (
        <ApplyLeaveForm leaveTypes={options} minDate={minDate} maxDate={maxDate} currentYear={year} />
      ) : (
        <EmptyState title="Leave requests are not available" description="No leave types have been set up yet. Please contact HR." />
      )}
    </div>
  )
}
