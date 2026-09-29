import { describe, expect, test } from "vitest"

import { isPathForDetails, storagePathFor } from "@/lib/payroll"
import type { UploadDetails } from "@/lib/validations/payroll"

const employee = "8a1c3c5e-6a3f-4b52-9d8e-2f5b0f6e7a91"
const other = "0b7f4a2e-1c3d-4e5f-8a9b-0c1d2e3f4a5b"
const details: UploadDetails = {
  employee_id: employee,
  kind: "payslips",
  year: 2026,
  month: 9,
  file_name: "Payslip.pdf",
  file_size: 1000,
  replace: false,
}

describe("payroll storage paths", () => {
  test("are chosen by the server inside the employee's own folder", () => {
    const path = storagePathFor(details)
    expect(path).toMatch(new RegExp(`^${employee}/payslips/2026-09-[0-9a-f-]{36}\.pdf$`))
    expect(storagePathFor({ ...details, kind: "ytd", month: null })).toMatch(new RegExp(`^${employee}/ytd/2026-`))
  })

  test("never repeat, so replacing a document cannot overwrite another file", () => {
    expect(storagePathFor(details)).not.toBe(storagePathFor(details))
  })

  test("must match the details being saved", () => {
    expect(isPathForDetails(storagePathFor(details), details)).toBe(true)
    expect(isPathForDetails(`${other}/payslips/2026-09-x.pdf`, details)).toBe(false)
    expect(isPathForDetails(`${employee}/ytd/2026-x.pdf`, details)).toBe(false)
    expect(isPathForDetails(`${employee}/payslips/../../${other}/x.pdf`, details)).toBe(false)
    expect(isPathForDetails(`${employee}/payslips/nested/x.pdf`, details)).toBe(false)
    expect(isPathForDetails(`${employee}/payslips/x.exe`, details)).toBe(false)
  })
})
