import { describe, expect, test } from "vitest"

import {
  financialYearLabel,
  financialYearOf,
  formatDateRange,
  formatDays,
  greetingFor,
  payslipPeriod,
  todayIn,
} from "@/lib/utils/format"

describe("formatting", () => {
  test("financial years run April to March", () => {
    expect(financialYearLabel(2026)).toBe("FY 2026-27")
    expect(financialYearLabel(2099)).toBe("FY 2099-00")
    expect(financialYearOf("2026-03-31")).toBe(2025)
    expect(financialYearOf("2026-04-01")).toBe(2026)
  })

  test("payslip periods and days", () => {
    expect(payslipPeriod(2026, 9)).toBe("September 2026")
    expect(formatDays(1)).toBe("1 day")
    expect(formatDays(2.5)).toBe("2.5 days")
    expect(formatDays(12)).toBe("12 days")
  })

  test("date ranges", () => {
    expect(formatDateRange("2026-10-05", "2026-10-05")).toBe("5 Oct 2026")
    expect(formatDateRange("2026-10-05", "2026-10-07")).toBe("5 Oct – 7 Oct 2026")
  })

  test("'today' follows the company time zone, not the server's", () => {
    // 20:00 UTC on 30 Sep is already 1 Oct in India.
    const late = new Date("2026-09-30T20:00:00Z")
    expect(todayIn("Asia/Kolkata", late)).toBe("2026-10-01")
    expect(todayIn("UTC", late)).toBe("2026-09-30")
    expect(greetingFor("Asia/Kolkata", new Date("2026-09-30T03:00:00Z"))).toBe("Good morning")
  })
})
