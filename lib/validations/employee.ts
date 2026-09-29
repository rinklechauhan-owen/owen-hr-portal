import { z } from "zod"

import { emailField } from "./auth"

export const PHONE_PATTERN = /^\+?[0-9 ()-]{7,20}$/

export const phoneField = z
  .string()
  .trim()
  .refine((value) => value === "" || PHONE_PATTERN.test(value), "Enter a valid phone number, e.g. +91 98765 43210.")

const optionalText = (max: number, label: string) =>
  z.string().trim().max(max, `${label} must be ${max} characters or fewer.`)

export const employeeSchema = z.object({
  employee_code: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9-]{2,20}$/, "Use 2–20 letters, numbers or hyphens, e.g. OM-014."),
  first_name: z.string().trim().min(1, "Enter a first name.").max(60, "Use 60 characters or fewer."),
  last_name: z.string().trim().min(1, "Enter a last name.").max(60, "Use 60 characters or fewer."),
  email: emailField,
  phone: phoneField,
  department_id: z.union([z.uuid("Choose a department."), z.literal("")]),
  designation: optionalText(120, "Designation").refine(
    (value) => value === "" || value.length >= 2,
    "Designation must be at least 2 characters."
  ),
  joining_date: z.iso.date("Enter a valid joining date."),
})

export type EmployeeInput = z.input<typeof employeeSchema>

export const phoneSchema = z.object({ phone: phoneField })

export const employeeFiltersSchema = z.object({
  q: z.string().trim().max(100).catch(""),
  department: z.union([z.uuid(), z.literal("")]).catch(""),
  status: z.enum(["active", "inactive", ""]).catch("active"),
  page: z.coerce.number().int().min(1).catch(1),
})

/** Turns empty optional form fields into nulls for the database. */
export function employeeToRow(input: z.output<typeof employeeSchema>) {
  return {
    employee_code: input.employee_code,
    first_name: input.first_name,
    last_name: input.last_name,
    email: input.email,
    phone: input.phone || null,
    department_id: input.department_id || null,
    designation: input.designation || null,
    joining_date: input.joining_date,
  }
}
