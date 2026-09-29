import type { PGlite } from "@electric-sql/pglite"

import { addDays, companyToday, createEmployee, createUser, futureMonday } from "./harness"

/**
 * An admin, two employees with logins (A and B), a mandatory holiday on the Tuesday
 * of a future work week and an optional holiday on its Wednesday.
 */
export async function seedCompany(db: PGlite) {
  const adminUserId = await createUser(db, "hr@owen-media.test", "admin")
  const aliceUserId = await createUser(db, "alice@owen-media.test")
  const bobUserId = await createUser(db, "bob@owen-media.test")

  const aliceId = await createEmployee(db, {
    code: "OM-001", firstName: "Alice", lastName: "Rao", email: "alice@owen-media.test", profileId: aliceUserId,
  })
  const bobId = await createEmployee(db, {
    code: "OM-002", firstName: "Bob", lastName: "Shah", email: "bob@owen-media.test", profileId: bobUserId,
  })

  const today = await companyToday(db)
  const monday = futureMonday(today)
  const tuesday = addDays(monday, 1)
  const wednesday = addDays(monday, 2)
  const year = Number(monday.slice(0, 4))

  // Balances for the test week's year (new employees get this year's automatically).
  await db.query(
    `insert into public.leave_balances (employee_id, leave_type_id, year, allocated_days)
     select e.id, t.id, $1, t.default_days
     from public.employees e cross join public.leave_types t
     where t.requires_balance
     on conflict (employee_id, leave_type_id, year) do nothing`,
    [year]
  )

  await db.query(
    `insert into public.holidays (name, holiday_date, is_optional) values
       ('Test Mandatory Holiday', $1, false),
       ('Test Optional Holiday', $2, true)`,
    [tuesday, wednesday]
  )

  const types = await db.query<{ id: string; name: string }>("select id, name from public.leave_types")
  const typeId = (name: string) => types.rows.find((t) => t.name === name)!.id

  return {
    admin: { kind: "user" as const, id: adminUserId },
    alice: { kind: "user" as const, id: aliceUserId },
    bob: { kind: "user" as const, id: bobUserId },
    aliceId,
    bobId,
    today,
    monday,
    year,
    casual: typeId("Casual Leave"),
    sick: typeId("Sick Leave"),
    unpaid: typeId("Unpaid Leave"),
  }
}

export type Company = Awaited<ReturnType<typeof seedCompany>>
