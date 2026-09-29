#!/usr/bin/env node
// Creates the first HR administrator. Sign-ups are disabled, so the very first
// admin has to be created with the service role key; every later account is
// created from the Admin Portal.
//
// Usage (reads keys from .env.local; nothing is printed except the result):
//   node --env-file=.env.local scripts/create-admin.mjs --email hr@owen-media.com --name "Priya Sharma"
//
// Optional: also create their employee record so they can use the Employee Portal:
//   ... --employee-code OM-001 --first-name Priya --last-name Sharma --joining-date 2024-04-01
//
// The person receives an invite email and chooses their own password.

import { parseArgs } from "node:util"

import { createClient } from "@supabase/supabase-js"

const { values } = parseArgs({
  options: {
    email: { type: "string" },
    name: { type: "string" },
    "employee-code": { type: "string" },
    "first-name": { type: "string" },
    "last-name": { type: "string" },
    "joining-date": { type: "string" },
  },
})

function fail(message) {
  console.error(`Error: ${message}`)
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000"
if (!url || !serviceKey) fail("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set (use --env-file=.env.local).")

const email = values.email?.trim().toLowerCase()
const name = values.name?.trim()
if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) fail("Pass a valid --email.")
if (!name) fail('Pass --name "Full Name".')

const wantsEmployee = Boolean(values["employee-code"])
if (wantsEmployee && !(values["first-name"] && values["last-name"] && values["joining-date"])) {
  fail("--employee-code also needs --first-name, --last-name and --joining-date (YYYY-MM-DD).")
}

const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
  redirectTo: `${siteUrl}/auth/confirm?next=/reset-password`,
  data: { full_name: name },
})
if (inviteError) fail(inviteError.code === "email_exists" ? "A login with this email already exists." : inviteError.message)
const userId = invited.user.id

const { error: roleError } = await supabase.from("profiles").update({ role: "admin", full_name: name }).eq("id", userId)
if (roleError) fail(`Invite sent, but the admin role could not be set: ${roleError.message}`)

if (wantsEmployee) {
  const { data: employee, error: employeeError } = await supabase
    .from("employees")
    .insert({
      employee_code: values["employee-code"].toUpperCase(),
      first_name: values["first-name"],
      last_name: values["last-name"],
      email,
      joining_date: values["joining-date"],
    })
    .select("id")
    .single()
  if (employeeError) fail(`Admin created, but the employee record failed: ${employeeError.message}`)

  const { error: linkError } = await supabase.rpc("service_link_employee_profile", {
    p_employee_id: employee.id,
    p_profile_id: userId,
    p_actor_id: null,
  })
  if (linkError) fail(`Employee created, but linking the login failed: ${linkError.message}`)
}

console.log(`Done. An invite has been emailed to ${email}. They are an admin${wantsEmployee ? " and an employee" : ""}.`)
