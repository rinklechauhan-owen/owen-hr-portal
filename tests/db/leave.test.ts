import type { PGlite } from "@electric-sql/pglite"
import { beforeEach, describe, expect, test } from "vitest"

import { type Company, seedCompany } from "./fixtures"
import { addDays, asActor, createDatabase, errorMessage, failureOf } from "./harness"

let db: PGlite
let c: Company

beforeEach(async () => {
  db = await createDatabase()
  c = await seedCompany(db)
})

type Request = { id: string; status: string; total_days: string; rejection_reason: string | null }

function apply(actor: Company["alice"], employeeId: string, typeId: string, start: string, end: string, extra = "") {
  return asActor(db, actor, async (tx) => {
    const { rows } = await tx.query<Request>(
      `insert into public.leave_requests (employee_id, leave_type_id, start_date, end_date, reason${extra ? ", status" : ""})
       values ($1, $2, $3, $4, 'Personal work'${extra ? `, '${extra}'` : ""})
       returning id, status, total_days::text, rejection_reason`,
      [employeeId, typeId, start, end]
    )
    return rows[0]
  })
}

async function balance(employeeId: string, typeId: string) {
  const { rows } = await db.query<{ allocated: number; used: number; remaining: number; pending: number; available: number }>(
    `select allocated_days::float as allocated, used_days::float as used, remaining_days::float as remaining,
            pending_days::float as pending, available_days::float as available
     from public.leave_balance_summary where employee_id = $1 and leave_type_id = $2 and year = $3`,
    [employeeId, typeId, c.year]
  )
  return rows[0]
}

describe("Applying for leave", () => {
  test("counts working days only: skips weekends and mandatory holidays, not optional ones", async () => {
    // Monday to next Monday: 6 weekdays, minus the mandatory Tuesday holiday = 5.
    const request = await apply(c.alice, c.aliceId, c.casual, c.monday, addDays(c.monday, 7))
    expect(request.status).toBe("pending")
    expect(Number(request.total_days)).toBe(5)
  })

  test("ignores a status sent by the browser", async () => {
    const request = await apply(c.alice, c.aliceId, c.casual, c.monday, c.monday, "approved")
    expect(request.status).toBe("pending")
  })

  test("rejects an end date before the start date", async () => {
    const message = await failureOf(apply(c.alice, c.aliceId, c.casual, c.monday, addDays(c.monday, -1)))
    expect(message).toBe("End date cannot be before start date.")
  })

  test("rejects a range that is only weekends and holidays", async () => {
    const saturday = addDays(c.monday, 5)
    const message = await failureOf(apply(c.alice, c.aliceId, c.casual, saturday, addDays(saturday, 1)))
    expect(message).toBe("The selected dates fall on weekends or holidays, so no leave is needed.")
  })

  test("rejects leave spanning two calendar years", async () => {
    const message = await failureOf(apply(c.alice, c.aliceId, c.casual, `${c.year}-12-30`, `${c.year + 1}-01-02`)
    )
    expect(message).toMatch(/cannot span two calendar years|at most \d+ days in advance/)
  })

  test("rejects dates too far in the past", async () => {
    const message = await failureOf(apply(c.alice, c.aliceId, c.casual, addDays(c.today, -60), addDays(c.today, -60))
    )
    expect(message).toMatch(/backdated by at most 30 days|two calendar years/)
  })

  test("rejects overlapping requests", async () => {
    await apply(c.alice, c.aliceId, c.casual, c.monday, addDays(c.monday, 2))
    const message = await failureOf(apply(c.alice, c.aliceId, c.sick, addDays(c.monday, 2), addDays(c.monday, 3))
    )
    expect(message).toBe("You already have a leave request that overlaps these dates.")
  })

  test("rejects requests larger than the available balance", async () => {
    await db.query(
      "update public.leave_balances set allocated_days = 2 where employee_id = $1 and leave_type_id = $2 and year = $3",
      [c.aliceId, c.casual, c.year]
    )
    const message = await failureOf(apply(c.alice, c.aliceId, c.casual, c.monday, addDays(c.monday, 3))
    )
    expect(message).toBe("Not enough Casual Leave balance. This request needs 3 day(s) and you have 2 available.")
  })

  test("counts pending requests against the available balance", async () => {
    await db.query(
      "update public.leave_balances set allocated_days = 3 where employee_id = $1 and leave_type_id = $2 and year = $3",
      [c.aliceId, c.casual, c.year]
    )
    await apply(c.alice, c.aliceId, c.casual, c.monday, addDays(c.monday, 2)) // 2 days
    expect(await balance(c.aliceId, c.casual)).toMatchObject({ allocated: 3, used: 0, pending: 2, available: 1 })

    const message = await failureOf(apply(c.alice, c.aliceId, c.casual, addDays(c.monday, 7), addDays(c.monday, 8))
    )
    expect(message).toMatch(/you have 1 available/)
  })

  test("unpaid leave does not need a balance", async () => {
    const request = await apply(c.alice, c.aliceId, c.unpaid, c.monday, addDays(c.monday, 4))
    expect(Number(request.total_days)).toBe(4)
  })
})

describe("Reviewing leave", () => {
  test("approval updates used and remaining days in the same transaction", async () => {
    const request = await apply(c.alice, c.aliceId, c.casual, c.monday, addDays(c.monday, 3)) // 3 days
    await asActor(db, c.admin, (tx) => tx.query("select public.review_leave_request($1, 'approved')", [request.id]))

    expect(await balance(c.aliceId, c.casual)).toMatchObject({ allocated: 12, used: 3, remaining: 9, pending: 0, available: 9 })
    const { rows } = await db.query<{ status: string; reviewed_by: string }>(
      "select status, reviewed_by from public.leave_requests where id = $1", [request.id]
    )
    expect(rows[0]).toEqual({ status: "approved", reviewed_by: c.admin.id })

    const notes = await asActor(db, c.alice, (tx) =>
      tx.query<{ type: string }>("select type from public.notifications")
    )
    expect(notes.rows.map((n) => n.type)).toContain("leave_approved")

    const logs = await db.query<{ action: string }>("select action from public.audit_logs where entity_id = $1", [request.id])
    expect(logs.rows.map((l) => l.action)).toEqual(["leave.submitted", "leave.approved"])
  })

  test("a request cannot be approved twice", async () => {
    const request = await apply(c.alice, c.aliceId, c.casual, c.monday, c.monday)
    await asActor(db, c.admin, (tx) => tx.query("select public.review_leave_request($1, 'approved')", [request.id]))
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query("select public.review_leave_request($1, 'approved')", [request.id])
    )
    expect(message).toBe("This request has already been approved.")
    expect((await balance(c.aliceId, c.casual)).used).toBe(1)
  })

  test("approval is blocked if HR reduced the balance below what is needed", async () => {
    const request = await apply(c.alice, c.aliceId, c.casual, c.monday, addDays(c.monday, 3))
    await db.query(
      "update public.leave_balances set allocated_days = 1 where employee_id = $1 and leave_type_id = $2 and year = $3",
      [c.aliceId, c.casual, c.year]
    )
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query("select public.review_leave_request($1, 'approved')", [request.id])
    )
    expect(message).toMatch(/Approving would exceed the Casual Leave balance/)
  })

  test("rejection requires a reason, saves it and leaves the balance unchanged", async () => {
    const request = await apply(c.alice, c.aliceId, c.casual, c.monday, c.monday)
    const missing = await errorMessage(db, c.admin, (tx) =>
      tx.query("select public.review_leave_request($1, 'rejected', '  ')", [request.id])
    )
    expect(missing).toBe("Please enter a reason for rejecting this request.")

    await asActor(db, c.admin, (tx) =>
      tx.query("select public.review_leave_request($1, 'rejected', 'Project deadline')", [request.id])
    )
    const { rows } = await db.query<{ status: string; rejection_reason: string }>(
      "select status, rejection_reason from public.leave_requests where id = $1", [request.id]
    )
    expect(rows[0]).toEqual({ status: "rejected", rejection_reason: "Project deadline" })
    expect(await balance(c.aliceId, c.casual)).toMatchObject({ used: 0, pending: 0, available: 12 })
  })

  test("revoking approved leave returns the days", async () => {
    const request = await apply(c.alice, c.aliceId, c.casual, c.monday, addDays(c.monday, 3))
    await asActor(db, c.admin, (tx) => tx.query("select public.review_leave_request($1, 'approved')", [request.id]))
    await asActor(db, c.admin, (tx) => tx.query("select public.revoke_leave_request($1, 'Office closed')", [request.id]))
    expect(await balance(c.aliceId, c.casual)).toMatchObject({ used: 0, available: 12 })
  })

  test("admins cannot edit used days directly", async () => {
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query("update public.leave_balances set used_days = 5 where employee_id = $1", [c.aliceId])
    )
    expect(message).toBe("Used days are calculated from approved leave and cannot be set directly.")
  })

  test("admins can change allocations", async () => {
    await asActor(db, c.admin, (tx) =>
      tx.query(
        "update public.leave_balances set allocated_days = 20 where employee_id = $1 and leave_type_id = $2 and year = $3",
        [c.aliceId, c.casual, c.year]
      )
    )
    expect((await balance(c.aliceId, c.casual)).allocated).toBe(20)
  })

  test("an admin cannot review their own leave", async () => {
    const adminEmployee = await db.query<{ id: string }>(
      `insert into public.employees (employee_code, first_name, last_name, email, joining_date, profile_id)
       values ('OM-900', 'Hema', 'Roy', 'hr@owen-media.test', '2024-01-01', $1) returning id`,
      [c.admin.id]
    )
    await db.query(
      `insert into public.leave_balances (employee_id, leave_type_id, year, allocated_days)
       values ($1, $2, $3, 12) on conflict do nothing`,
      [adminEmployee.rows[0].id, c.casual, c.year]
    )
    const request = await apply(c.admin, adminEmployee.rows[0].id, c.casual, c.monday, c.monday)
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query("select public.review_leave_request($1, 'approved')", [request.id])
    )
    expect(message).toBe("You cannot review your own leave request. Ask another administrator.")
  })

  test("an admin cannot change their own leave balance", async () => {
    const adminEmployee = await db.query<{ id: string }>(
      `insert into public.employees (employee_code, first_name, last_name, email, joining_date, profile_id)
       values ('OM-901', 'Hema', 'Roy', 'hr@owen-media.test', '2024-01-01', $1) returning id`,
      [c.admin.id]
    )
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query("update public.leave_balances set allocated_days = 99 where employee_id = $1", [adminEmployee.rows[0].id])
    )
    expect(message).toBe("You cannot change your own leave balance. Ask another administrator.")
  })

  test("the database sets a new request's id and timestamps", async () => {
    const forgedId = "00000000-0000-4000-8000-000000000001"
    const row = await asActor(db, c.alice, async (tx) => {
      const { rows } = await tx.query<{ id: string; created_at: string }>(
        `insert into public.leave_requests (id, employee_id, leave_type_id, start_date, end_date, reason, created_at)
         values ($1, $2, $3, $4, $4, 'Personal work', '2000-01-01') returning id, created_at::text`,
        [forgedId, c.aliceId, c.casual, c.monday]
      )
      return rows[0]
    })
    expect(row.id).not.toBe(forgedId)
    expect(row.created_at.startsWith("2000")).toBe(false)
  })

  test("employees can cancel their own pending request", async () => {
    const request = await apply(c.alice, c.aliceId, c.casual, c.monday, c.monday)
    await asActor(db, c.alice, (tx) => tx.query("select public.cancel_leave_request($1)", [request.id]))
    expect(await balance(c.aliceId, c.casual)).toMatchObject({ pending: 0, available: 12 })
    // The dates are free again.
    await apply(c.alice, c.aliceId, c.casual, c.monday, c.monday)
  })

  test("the leave-day preview matches the saved value", async () => {
    const preview = await asActor(db, c.alice, (tx) =>
      tx.query<{ days: number }>("select public.calculate_leave_days($1, $2) as days", [c.monday, addDays(c.monday, 7)])
    )
    expect(preview.rows[0].days).toBe(5)
  })
})
