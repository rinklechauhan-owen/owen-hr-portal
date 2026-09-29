import type { PGlite } from "@electric-sql/pglite"
import { beforeAll, describe, expect, test } from "vitest"

import { type Company, seedCompany } from "./fixtures"
import { asActor, createDatabase, errorMessage } from "./harness"

let db: PGlite
let c: Company

beforeAll(async () => {
  db = await createDatabase()
  c = await seedCompany(db)
})

describe("Payroll documents", () => {
  test("an admin upload is visible to its employee only, notifies them and is audited", async () => {
    await asActor(db, c.admin, async (tx) => {
      await tx.query(
        `insert into storage.objects (bucket_id, name) values ('payroll-documents', $1::text || '/payslips/2026-09-x.pdf')`,
        [c.aliceId]
      )
      await tx.query(
        `insert into public.payslips (employee_id, month, year, file_path, file_name, file_size, uploaded_by)
         values ($1::uuid, 9, 2026, $1::text || '/payslips/2026-09-x.pdf', 'Payslip Sep 2026.pdf', 2048, $2)`,
        [c.aliceId, c.admin.id]
      )
    })

    const alice = await asActor(db, c.alice, (tx) =>
      tx.query<{ file_name: string }>("select file_name from public.payslips")
    )
    expect(alice.rows).toEqual([{ file_name: "Payslip Sep 2026.pdf" }])

    const bob = await asActor(db, c.bob, (tx) => tx.query("select * from public.payslips"))
    expect(bob.rows).toHaveLength(0)

    const notes = await asActor(db, c.alice, (tx) =>
      tx.query<{ message: string }>("select message from public.notifications where type = 'payslip_available'")
    )
    expect(notes.rows[0].message).toBe("Your payslip for September 2026 is ready to view.")

    const logs = await db.query<{ action: string; user_id: string }>(
      "select action, user_id from public.audit_logs where action = 'payslip.uploaded'"
    )
    expect(logs.rows).toEqual([{ action: "payslip.uploaded", user_id: c.admin.id }])
  })

  test("only one payslip per employee per month", async () => {
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query(
        `insert into public.payslips (employee_id, month, year, file_path, file_name, file_size)
         values ($1::uuid, 9, 2026, $1::text || '/payslips/2026-09-y.pdf', 'Again.pdf', 10)`,
        [c.aliceId]
      )
    )
    expect(message).toMatch(/duplicate key/)
  })

  test("a file path must sit in the owning employee's folder", async () => {
    const message = await errorMessage(db, c.admin, (tx) =>
      tx.query(
        `insert into public.ytd_reports (employee_id, year, file_path, file_name, file_size)
         values ($1::uuid, 2026, $2::text || '/ytd/2026.pdf', 'Wrong folder.pdf', 10)`,
        [c.aliceId, c.bobId]
      )
    )
    expect(message).toMatch(/ytd_reports_file_path_owner/)
  })

  test("YTD and PF reports use financial-year labels", async () => {
    await asActor(db, c.admin, (tx) =>
      tx.query(
        `insert into public.pf_ytd_reports (employee_id, year, file_path, file_name, file_size)
         values ($1::uuid, 2026, $1::text || '/pf-ytd/2026.pdf', 'PF.pdf', 10)`,
        [c.bobId]
      )
    )
    const notes = await asActor(db, c.bob, (tx) =>
      tx.query<{ message: string }>("select message from public.notifications where type = 'pf_ytd_report_available'")
    )
    expect(notes.rows[0].message).toBe("Your PF YTD report for FY 2026-27 is ready to view.")
  })

  test("the payroll status report shows who is missing documents", async () => {
    const { rows } = await asActor(db, c.admin, (tx) =>
      tx.query<{ employee_code: string; has_payslip: boolean; has_pf_ytd_report: boolean }>(
        "select employee_code, has_payslip, has_pf_ytd_report from public.report_payroll_status(2026, 9)"
      )
    )
    expect(rows).toEqual([
      { employee_code: "OM-001", has_payslip: true, has_pf_ytd_report: false },
      { employee_code: "OM-002", has_payslip: false, has_pf_ytd_report: true },
    ])
  })
})
