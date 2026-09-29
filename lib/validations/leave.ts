import { z } from "zod"

// Client-side checks for fast feedback. The database repeats every one of these
// (and the balance, overlap and holiday rules) when the request is saved.
export const applyLeaveSchema = z
  .object({
    leave_type_id: z.uuid("Choose a leave type."),
    start_date: z.iso.date("Choose a start date."),
    end_date: z.iso.date("Choose an end date."),
    reason: z
      .string()
      .trim()
      .min(3, "Please enter a reason for your leave.")
      .max(1000, "The reason must be 1000 characters or fewer."),
  })
  .superRefine((values, ctx) => {
    if (values.end_date < values.start_date) {
      ctx.addIssue({ code: "custom", path: ["end_date"], message: "End date cannot be before start date." })
    } else if (values.start_date.slice(0, 4) !== values.end_date.slice(0, 4)) {
      ctx.addIssue({
        code: "custom",
        path: ["end_date"],
        message: "Leave cannot span two calendar years. Please submit a separate request for each year.",
      })
    }
  })

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>

const reasonField = (empty: string) =>
  z.string().trim().min(3, empty).max(1000, "The reason must be 1000 characters or fewer.")

export const reviewLeaveSchema = z.discriminatedUnion("decision", [
  z.object({ request_id: z.uuid(), decision: z.literal("approved") }),
  z.object({
    request_id: z.uuid(),
    decision: z.literal("rejected"),
    rejection_reason: reasonField("Please enter a reason for rejecting this request."),
  }),
])

export const revokeLeaveSchema = z.object({
  request_id: z.uuid(),
  reason: reasonField("Please enter a reason for revoking this leave."),
})

export const rejectionReasonSchema = z.object({
  reason: reasonField("Please enter a reason."),
})

const halfDayStep = z
  .number({ message: "Enter a number of days." })
  .min(0, "Days cannot be negative.")
  .max(365, "Use 365 days or fewer.")
  .refine((value) => Number.isInteger(value * 2), "Use whole or half days.")

export const leaveTypeSchema = z.object({
  name: z.string().trim().min(2, "Enter a name.").max(60, "Use 60 characters or fewer."),
  description: z.string().trim().max(500, "Use 500 characters or fewer."),
  default_days: halfDayStep,
  requires_balance: z.boolean(),
  is_active: z.boolean(),
})

export const balanceSchema = z.object({
  balance_id: z.uuid(),
  allocated_days: halfDayStep,
})

export const createBalanceSchema = z.object({
  employee_id: z.uuid(),
  leave_type_id: z.uuid("Choose a leave type."),
  year: z.number().int().min(2000).max(2100),
  allocated_days: halfDayStep,
})

export const LEAVE_STATUSES = ["pending", "approved", "rejected", "cancelled"] as const
