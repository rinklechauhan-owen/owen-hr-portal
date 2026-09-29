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
//
// If email can't be sent (for example Supabase's built-in email rate limit), add
// --print-link: no email is sent and a one-time "set your password" link is printed
// instead. Open it yourself or pass it to the person privately; it signs them in.

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
    "print-link": { type: "boolean", default: false },
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

// Safe to re-run: if the login already exists (for example the invite was sent but
// a later step failed), finish setting it up instead of inviting again.
const { data: existing, error: lookupError } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle()
if (lookupError) fail(`Could not check for an existing login: ${lookupError.message}`)

const printLink = values["print-link"]
const redirectTo = `${siteUrl}/auth/confirm?next=/reset-password`
let userId = existing?.id
let invitedNow = false
let setPasswordLink = null

if (!userId) {
  if (printLink) {
    const { data, error } = await supabase.auth.admin.generateLink({
      type: "invite",
      email,
      options: { data: { full_name: name }, redirectTo },
    })
    if (error) fail(error.message)
    userId = data.user.id
    setPasswordLink = linkFor(data.properties)
  } else {
    const { data: invited, error: inviteError } = await supabase.auth.admin.inviteUserByEmail(email, {
      redirectTo,
      data: { full_name: name },
    })
    if (inviteError) {
      fail(
        inviteError.code === "over_email_send_rate_limit"
          ? "Supabase's email limit was reached. Re-run with --print-link to get the link without sending an email."
          : inviteError.message
      )
    }
    userId = invited.user.id
    invitedNow = true
  }
} else if (printLink) {
  const { data, error } = await supabase.auth.admin.generateLink({ type: "recovery", email, options: { redirectTo } })
  if (error) fail(error.message)
  setPasswordLink = linkFor(data.properties)
}

/** The app's own confirm route, which verifies the token on the server. */
function linkFor(properties) {
  const params = new URLSearchParams({
    token_hash: properties.hashed_token,
    type: properties.verification_type,
    next: "/reset-password",
  })
  return `${siteUrl}/auth/confirm?${params}`
}

const { error: roleError } = await supabase.from("profiles").update({ role: "admin", full_name: name }).eq("id", userId)
if (roleError) fail(`The admin role could not be set: ${roleError.message}`)

if (wantsEmployee) {
  const { data: linked } = await supabase.from("employees").select("id").eq("profile_id", userId).maybeSingle()
  if (linked) {
    console.log("This login already has an employee record; leaving it unchanged.")
  } else {
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
    if (employeeError) fail(`Admin set up, but the employee record failed: ${employeeError.message}`)

    const { error: linkError } = await supabase.rpc("service_link_employee_profile", {
      p_employee_id: employee.id,
      p_profile_id: userId,
      p_actor_id: null,
    })
    if (linkError) fail(`Employee created, but linking the login failed: ${linkError.message}`)
  }
}

if (setPasswordLink) {
  console.log(`Done. ${email} is an admin${wantsEmployee ? " and an employee" : ""}. No email was sent.`)
  console.log("One-time link to set the password (open it on the machine running the app; do not share it):")
  console.log(setPasswordLink)
  process.exit(0)
}

console.log(
  invitedNow
    ? `Done. An invite has been emailed to ${email}. They are an admin${wantsEmployee ? " and an employee" : ""}.`
    : `Done. ${email} is now an admin${wantsEmployee ? " and an employee" : ""}. Use the invite email already sent, or "Forgot password?" on the login page if it has expired.`
)
