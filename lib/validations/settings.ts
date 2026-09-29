import { z } from "zod"

import { emailField } from "./auth"

export const companySettingsSchema = z.object({
  company_name: z.string().trim().min(2, "Enter the company name.").max(120, "Use 120 characters or fewer."),
  weekend_days: z
    .array(z.number().int().min(0).max(6))
    .max(6, "At least one day of the week must be a working day.")
    .refine((days) => new Set(days).size === days.length, "Each day can only be chosen once."),
  max_backdate_days: z.number({ message: "Enter a number." }).int("Use whole days.").min(0).max(365, "Use 365 or fewer."),
  max_advance_days: z.number({ message: "Enter a number." }).int("Use whole days.").min(1).max(730, "Use 730 or fewer."),
})

export const departmentSchema = z.object({
  name: z.string().trim().min(2, "Enter a department name.").max(80, "Use 80 characters or fewer."),
})

export const inviteAdminSchema = z.object({
  full_name: z.string().trim().min(2, "Enter their name.").max(120, "Use 120 characters or fewer."),
  email: emailField,
})

export const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const
