import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, test } from "vitest"

import { type Company, seedCompany } from "./fixtures"
import { asActor, createDatabase, errorMessage } from "./harness"

let db: PGlite
let c: Company

beforeAll(async () => {
  db = await createDatabase()
  c = await seedCompany(db)

  // Payroll documents and a notification for Bob, so Alice has something to try to reach.
  await db.query(
    `insert into public.payslips (employee_id, month, year, file_path, file_name, file_size)
     values ($1::uuid, 8, 2026, $1::text || '/payslips/2026-08-a.pdf', 'Payslip Aug 2026.pdf', 1000)`,
    [c.bobId]
  )
  await db.query(
    `insert into public.ytd_reports (employee_id, year, file_path, file_name, file_size)
     values ($1::uuid, 2026, $1::text || '/ytd/2026-a.pdf', 'YTD FY 2026-27.pdf', 1000)`,
    [c.bobId]
  )
  await db.query(
    `insert into public.pf_ytd_reports (employee_id, year, file_path, file_name, file_size)
     values ($1::uuid, 2026, $1::text || '/pf-ytd/2026-a.pdf', 'PF YTD FY 2026-27.pdf', 1000)`,
    [c.bobId]
  )
  await db.query(
    `insert into storage.objects (bucket_id, name) values
       ('payroll-documents', $1::text || '/payslips/2026-08-a.pdf'),
       ('payroll-documents', $2::text || '/payslips/2026-08-b.pdf')`,
    [c.bobId, c.aliceId]
  )
  await asActor(db, c.bob, (tx) =>
    tx.query(
      `insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, reason)
       values ($1, $2, $3, $3, 'Family event')`,
      [c.bobId, c.casual, c.monday]
    )
  )
})

async function count(actor: Company["alice"], sql: string, params: unknown[] = []) {
  return asActor(db, actor, async (tx) => {
    const { rows } = await tx.query<{ n: number }>(`select count(*)::int as n from (${sql}) q`, params)
    return rows[0].n
  })
}

describe("Employee A cannot access Employee B's data", () => {
  test.each([
    ["profile", "select * from public.profiles where id = $1", "bobUser"],
    ["employee record", "select * from public.employees where id = $1", "bob"],
    ["leave balances", "select * from public.leave_balances where employee_id = $1", "bob"],
    ["leave balance summary", "select * from public.leave_balance_summary where employee_id = $1", "bob"],
    ["leave requests", "select * from public.leave_requests where employee_id = $1", "bob"],
    ["payslips", "select * from public.payslips where employee_id = $1", "bob"],
    ["YTD reports", "select * from public.ytd_reports where employee_id = $1", "bob"],
    ["PF YTD reports", "select * from public.pf_ytd_reports where employee_id = $1", "bob"],
    ["notifications", "select * from public.notifications where user_id = $1", "bobUser"],
  ])("%s, even when querying B's id directly", async (_name, sql, key) => {
    const id = key === "bob" ? c.bobId : c.bob.id
    expect(await count(c.alice, sql, [id])).toBe(0)
    // Sanity check: the rows exist and Bob can see his own.
    if (!sql.includes("notifications")) {
      expect(await count(c.bob, sql, [id])).toBeGreaterThan(0)
    }
  })

  test("sees only their own rows when listing without a filter", async () => {
    expect(await count(c.alice, "select * from public.employees")).toBe(1)
    expect(await count(c.alice, "select * from public.profiles")).toBe(1)
    expect(await count(c.alice, "select * from public.payslips")).toBe(0)
  })

  test("cannot read B's payroll file in storage", async () => {
    const own = await count(c.alice, "select * from storage.objects where name like $1::text || '/%'", [c.aliceId])
    const other = await count(c.alice, "select * from storage.objects where name like $1::text || '/%'", [c.bobId])
    expect(own).toBe(1)
    expect(other).toBe(0)
  })

  test("cannot create a leave request for B", async () => {
    const message = await errorMessage(db, c.alice, (tx) =>
      tx.query(
        `insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, reason)
         values ($1, $2, $3, $3, 'Not mine')`,
        [c.bobId, c.casual, c.monday]
      )
    )
    // Rejected before any validation runs, so nothing about B's leave is revealed.
    expect(message).toBe("You can only request leave for yourself.")
  })

  test("cannot change B's employee record or their own", async () => {
    const updated = await asActor(db, c.alice, async (tx) => {
      const other = await tx.query("update public.employees set designation = 'CEO' where id = $1", [c.bobId])
      const own = await tx.query("update public.employees set designation = 'CEO' where id = $1", [c.aliceId])
      return (other.affectedRows ?? 0) + (own.affectedRows ?? 0)
    })
    expect(updated).toBe(0)
  })

  test("cannot cancel B's leave request, even with its id", async () => {
    const { rows } = await db.query<{ id: string }>(
      "select id from public.leave_requests where employee_id = $1", [c.bobId]
    )
    const message = await errorMessage(db, c.alice, (tx) =>
      tx.query("select public.cancel_leave_request($1)", [rows[0].id])
    )
    expect(message).toBe("Leave request not found.")
  })
})

describe("Employees cannot perform admin actions", () => {
  test("cannot upload payroll documents", async () => {
    const message = await errorMessage(db, c.alice, (tx) =>
      tx.query(
        `insert into public.payslips (employee_id, month, year, file_path, file_name, file_size)
         values ($1::uuid, 9, 2026, $1::text || '/payslips/x.pdf', 'x.pdf', 10)`,
        [c.aliceId]
      )
    )
    expect(message).toMatch(/row-level security/)
  })

  test("cannot upload files to the payroll bucket", async () => {
    const message = await errorMessage(db, c.alice, (tx) =>
      tx.query(`insert into storage.objects (bucket_id, name) values ('payroll-documents', $1::text || '/payslips/y.pdf')`, [c.aliceId])
    )
    expect(message).toMatch(/row-level security/)
  })

  test("cannot add or edit holidays", async () => {
    const message = await errorMessage(db, c.alice, (tx) =>
      tx.query("insert into public.holidays (name, holiday_date) values ('Day off', '2026-12-31')")
    )
    expect(message).toMatch(/row-level security/)
    const edited = await asActor(db, c.alice, (tx) => tx.query("update public.holidays set name = 'Changed'"))
    expect(edited.affectedRows).toBe(0)
  })

  test("cannot approve or reject leave", async () => {
    const { rows } = await db.query<{ id: string }>("select id from public.leave_requests limit 1")
    const message = await errorMessage(db, c.alice, (tx) =>
      tx.query("select public.review_leave_request($1, 'approved')", [rows[0].id])
    )
    expect(message).toBe("Only HR administrators can review leave requests.")
  })

  test("cannot approve their own request by writing to it directly", async () => {
    const message = await errorMessage(db, c.bob, (tx) =>
      tx.query("update public.leave_requests set status = 'approved' where employee_id = $1", [c.bobId])
    )
    expect(message).toMatch(/permission denied/)
  })

  test("cannot make themselves an admin", async () => {
    const changed = await asActor(db, c.alice, (tx) =>
      tx.query("update public.profiles set role = 'admin' where id = $1", [c.alice.id])
    )
    expect(changed.affectedRows).toBe(0)
  })

  test("cannot read the audit log or run reports", async () => {
    expect(await count(c.alice, "select * from public.audit_logs")).toBe(0)
    const message = await errorMessage(db, c.alice, (tx) => tx.query("select public.get_admin_dashboard()"))
    expect(message).toBe("Only HR administrators can view the dashboard.")
  })

  test("cannot call trusted server-only functions", async () => {
    const message = await errorMessage(db, c.alice, (tx) =>
      tx.query("select public.service_link_employee_profile($1, $2, null)", [c.bobId, c.alice.id])
    )
    expect(message).toMatch(/permission denied/)
  })

  test("can mark their notification read but cannot rewrite it", async () => {
    await db.query(
      `insert into public.notifications (user_id, title, message, type) values ($1, 'Hi', 'Test', 'holiday_added')`,
      [c.alice.id]
    )
    const read = await asActor(db, c.alice, (tx) =>
      tx.query("update public.notifications set is_read = true where user_id = $1", [c.alice.id])
    )
    expect(read.affectedRows).toBeGreaterThan(0)
    const message = await errorMessage(db, c.alice, (tx) =>
      tx.query("update public.notifications set title = 'Changed' where user_id = $1", [c.alice.id])
    )
    expect(message).toMatch(/permission denied/)
  })
})

describe("Anonymous visitors", () => {
  test("cannot read anything", async () => {
    for (const table of ["employees", "payslips", "holidays", "leave_requests", "profiles"]) {
      const message = await errorMessage(db, { kind: "anon" }, (tx) => tx.query(`select * from public.${table}`))
      expect(message).toMatch(/permission denied/)
    }
  })
})

describe("Disabled employees", () => {
  test("lose access to their data immediately", async () => {
    await asActor(db, c.admin, (tx) =>
      tx.query("update public.employees set status = 'inactive' where id = $1", [c.bobId])
    )
    expect(await count(c.bob, "select * from public.employees")).toBe(0)
    expect(await count(c.bob, "select * from public.payslips")).toBe(0)
    expect(await count(c.bob, "select * from public.holidays")).toBe(0)
    const message = await errorMessage(db, c.bob, (tx) =>
      tx.query(
        `insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, reason)
         values ($1, $2, $3, $3, 'Still here?')`,
        [c.bobId, c.casual, c.monday]
      )
    )
    expect(message).toBe("You can only request leave for yourself.")

    const { rows } = await db.query<{ is_active: boolean }>("select is_active from public.profiles where id = $1", [c.bob.id])
    expect(rows[0].is_active).toBe(false)

    await asActor(db, c.admin, (tx) =>
      tx.query("update public.employees set status = 'active' where id = $1", [c.bobId])
    )
    expect(await count(c.bob, "select * from public.employees")).toBe(1)
  })
})

describe("Admins", () => {
  test("can read every employee's records", async () => {
    expect(await count(c.admin, "select * from public.employees")).toBe(2)
    expect(await count(c.admin, "select * from public.payslips")).toBe(1)
    expect(await count(c.admin, "select * from storage.objects")).toBe(2)
  })

  test("can create and update employees, but cannot link logins directly", async () => {
    const id = await asActor(db, c.admin, async (tx) => {
      const { rows } = await tx.query<{ id: string }>(
        `insert into public.employees (employee_code, first_name, last_name, email, joining_date)
         values ('OM-003', 'Chitra', 'Iyer', 'chitra@owen-media.test', '2026-01-05') returning id`
      )
      await tx.query("update public.employees set designation = 'Designer' where id = $1", [rows[0].id])
      return rows[0].id
    })
    expect(id).toBeTruthy()

    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query("update public.employees set profile_id = $1 where id = $2", [c.alice.id, id])
    )
    expect(message).toBe("Portal access is managed from the employee's access settings.")
  })

  test("new employees receive default leave balances", async () => {
    const { rows } = await db.query<{ n: number }>(
      `select count(*)::int as n from public.leave_balances b
       join public.employees e on e.id = b.employee_id where e.employee_code = 'OM-003'`
    )
    expect(rows[0].n).toBe(3)
  })

  test("cannot change their own role", async () => {
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query("update public.profiles set role = 'employee' where id = $1", [c.admin.id])
    )
    expect(message).toBe("You cannot change your own role or access.")
  })

  test("cannot delete employees", async () => {
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query("delete from public.employees where id = $1", [c.bobId])
    )
    expect(message).toMatch(/permission denied/)
  })

  test("can read the audit log, which records who did what", async () => {
    const { rows } = await asActor(db, c.admin, (tx) =>
      tx.query<{ action: string; user_id: string | null }>(
        "select action, user_id from public.audit_logs where action in ('employee.disabled', 'employee.created') order by id"
      )
    )
    const disabled = rows.find((r) => r.action === "employee.disabled")
    expect(disabled?.user_id).toBe(c.admin.id)
    expect(rows.some((r) => r.action === "employee.created")).toBe(true)
  })
})
