import { describe, expect, test } from "vitest"

import { decideRouteAccess, homeFor, safeNextPath } from "@/lib/auth/access"

describe("route protection", () => {
  test.each(["/employee", "/employee/salary/payslips", "/admin", "/admin/employees/123"])(
    "signed-out visitors to %s are sent to /login with a return path",
    (path) => {
      expect(decideRouteAccess(path, "?tab=leave", false)).toEqual({
        type: "redirect",
        to: `/login?next=${encodeURIComponent(`${path}?tab=leave`)}`,
      })
    }
  )

  test("public pages stay public", () => {
    expect(decideRouteAccess("/login", "", false)).toEqual({ type: "allow" })
    expect(decideRouteAccess("/forgot-password", "", false)).toEqual({ type: "allow" })
    expect(decideRouteAccess("/auth/confirm", "?token_hash=x", false)).toEqual({ type: "allow" })
  })

  test("look-alike paths are not treated as protected", () => {
    expect(decideRouteAccess("/administrator", "", false)).toEqual({ type: "allow" })
  })

  test("signed-in users skip the login page", () => {
    expect(decideRouteAccess("/login", "", true)).toEqual({ type: "redirect", to: "/" })
  })

  test("signed-in users can open protected pages (roles are checked in layouts)", () => {
    expect(decideRouteAccess("/admin", "", true)).toEqual({ type: "allow" })
  })
})

describe("post-login destination", () => {
  test("admins go to /admin and employees to /employee", () => {
    expect(homeFor("admin", false)).toBe("/admin")
    expect(homeFor("employee", true)).toBe("/employee")
  })

  test("employees cannot be sent to /admin", () => {
    expect(homeFor("employee", true, "/admin/employees")).toBe("/employee")
  })

  test("admins without an employee record go to /admin instead of /employee", () => {
    expect(homeFor("admin", false, "/employee/leave")).toBe("/admin")
  })

  test("a requested page is honoured when allowed", () => {
    expect(homeFor("employee", true, "/employee/salary?year=2026")).toBe("/employee/salary?year=2026")
  })

  test.each(["https://evil.example", "//evil.example", "/\\evil.example", "javascript:alert(1)"])(
    "rejects off-site redirect %s",
    (next) => {
      expect(safeNextPath(next)).toBeNull()
      expect(homeFor("employee", true, next)).toBe("/employee")
    }
  )
})
