import { describe, expect, test } from "vitest"

import { loginSchema, resetPasswordSchema } from "@/lib/validations/auth"
import { employeeSchema } from "@/lib/validations/employee"
import { applyLeaveSchema, reviewLeaveSchema } from "@/lib/validations/leave"
import { checkPdfFile, hasPdfSignature, uploadDetailsSchema } from "@/lib/validations/payroll"

const uuid = "8a1c3c5e-6a3f-4b52-9d8e-2f5b0f6e7a91"

function firstError(result: { success: boolean; error?: { issues: { message: string }[] } }) {
  return result.success ? null : result.error!.issues[0].message
}

describe("login", () => {
  test("normalises the email", () => {
    const result = loginSchema.parse({ email: "  Alice@Owen-Media.com ", password: "x" })
    expect(result.email).toBe("alice@owen-media.com")
  })

  test("requires a valid email and a password", () => {
    expect(firstError(loginSchema.safeParse({ email: "nope", password: "x" }))).toBe("Enter a valid email address.")
    expect(firstError(loginSchema.safeParse({ email: "a@b.co", password: "" }))).toBe("Enter your password.")
  })
})

describe("new passwords", () => {
  test("must be strong and match", () => {
    expect(firstError(resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" }))).toBe(
      "Use at least 10 characters."
    )
    expect(firstError(resetPasswordSchema.safeParse({ password: "alllowercase1", confirmPassword: "alllowercase1" }))).toBe(
      "Include an uppercase letter."
    )
    expect(firstError(resetPasswordSchema.safeParse({ password: "Str0ngPassword", confirmPassword: "Str0ngPasswrd" }))).toBe(
      "The passwords do not match."
    )
    expect(resetPasswordSchema.safeParse({ password: "Str0ngPassword", confirmPassword: "Str0ngPassword" }).success).toBe(true)
  })
})

describe("leave applications", () => {
  const base = { leave_type_id: uuid, start_date: "2026-10-05", end_date: "2026-10-07", reason: "Family function" }

  test("accepts a valid request", () => {
    expect(applyLeaveSchema.safeParse(base).success).toBe(true)
  })

  test("rejects an end date before the start date", () => {
    expect(firstError(applyLeaveSchema.safeParse({ ...base, end_date: "2026-10-01" }))).toBe(
      "End date cannot be before start date."
    )
  })

  test("rejects a range across two years", () => {
    expect(firstError(applyLeaveSchema.safeParse({ ...base, start_date: "2026-12-30", end_date: "2027-01-02" }))).toMatch(
      /cannot span two calendar years/
    )
  })

  test("requires a leave type and a reason", () => {
    expect(firstError(applyLeaveSchema.safeParse({ ...base, leave_type_id: "" }))).toBe("Choose a leave type.")
    expect(firstError(applyLeaveSchema.safeParse({ ...base, reason: "  " }))).toBe("Please enter a reason for your leave.")
  })

  test("rejection needs a reason, approval does not", () => {
    expect(reviewLeaveSchema.safeParse({ request_id: uuid, decision: "approved" }).success).toBe(true)
    expect(firstError(reviewLeaveSchema.safeParse({ request_id: uuid, decision: "rejected", rejection_reason: "" }))).toBe(
      "Please enter a reason for rejecting this request."
    )
  })
})

describe("employees", () => {
  const base = {
    employee_code: "om-014",
    first_name: "Asha",
    last_name: "Nair",
    email: "Asha.Nair@owen-media.com",
    phone: "",
    department_id: "",
    designation: "",
    joining_date: "2026-04-01",
  }

  test("normalises code and email", () => {
    const result = employeeSchema.parse(base)
    expect(result.employee_code).toBe("OM-014")
    expect(result.email).toBe("asha.nair@owen-media.com")
  })

  test("validates phone numbers", () => {
    expect(firstError(employeeSchema.safeParse({ ...base, phone: "call me" }))).toMatch(/valid phone number/)
    expect(employeeSchema.safeParse({ ...base, phone: "+91 98765 43210" }).success).toBe(true)
  })
})

describe("payroll uploads", () => {
  const details = {
    employee_id: uuid,
    kind: "payslips" as const,
    year: 2026,
    month: 9,
    file_name: "Payslip.pdf",
    file_size: 120_000,
    replace: false,
  }

  test("payslips need a month; YTD reports do not", () => {
    expect(firstError(uploadDetailsSchema.safeParse({ ...details, month: null }))).toBe("Choose the payslip month.")
    expect(uploadDetailsSchema.safeParse({ ...details, kind: "ytd", month: null }).success).toBe(true)
  })

  test("only PDFs up to 10 MB", () => {
    expect(firstError(uploadDetailsSchema.safeParse({ ...details, file_name: "payslip.docx" }))).toBe(
      "Only PDF files can be uploaded."
    )
    expect(firstError(uploadDetailsSchema.safeParse({ ...details, file_size: 11 * 1024 * 1024 }))).toBe(
      "The file must be 10 MB or smaller."
    )
  })

  test("checks the file in the browser", () => {
    expect(checkPdfFile(new File(["x"], "a.png", { type: "image/png" }))).toBe("Only PDF files can be uploaded.")
    expect(checkPdfFile(new File(["%PDF-1.7"], "a.pdf", { type: "application/pdf" }))).toBeNull()
  })

  test("recognises the PDF signature", () => {
    expect(hasPdfSignature(new TextEncoder().encode("%PDF-1.7\n..."))).toBe(true)
    expect(hasPdfSignature(new TextEncoder().encode("<html>"))).toBe(false)
  })
})
