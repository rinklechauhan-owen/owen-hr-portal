# Deployment

Owen HR runs as a normal Next.js app on Vercel with Supabase for the database,
authentication and file storage. Docker is not used anywhere.

```text
Users → Vercel (Next.js) → Supabase (Auth · PostgreSQL · Storage)
```

Use **two Supabase projects**: one for development/testing and one for production.
Never test with real employee data.

---

## 1. Supabase project

1. Create a project at https://supabase.com (region close to your users, e.g. Mumbai).
2. Save the database password in your password manager.
3. From **Project Settings → API Keys**, note:
   - the **anon** key (or a **publishable** key `sb_publishable_…`): safe for the browser;
   - the **service_role** key (or a **secret** key `sb_secret_…`): server only, never share it.

### Apply the database migrations

From the project folder:

```bash
npx supabase login
npx supabase link --project-ref <project-ref>
npm run db:push
```

This creates every table, constraint, index, function, trigger, RLS policy and the
private `payroll-documents` storage bucket. Re-run `npm run db:push` after pulling new
migrations. Never change the production schema by hand in the dashboard.

Check afterwards in the dashboard:

- **Database → Tables**: every table shows "RLS enabled".
- **Storage**: the `payroll-documents` bucket exists and is **not public**.

### Authentication settings

In **Authentication → Sign In / Providers**:

- **Allow new users to sign up: OFF.** Accounts are created only by HR.
- Email provider: enabled. Confirm email: can stay on (invites confirm the address).
- Password requirements: minimum length **10**, require lowercase, uppercase and digits.
- **Secure password change: ON** (a recent login is needed to change a password).
- **Rate limits** (Authentication → Rate Limits): sign-in and email requests reach
  Supabase from Vercel's servers, so raise the per-IP sign-in limit to suit your
  headcount, and set the email limit to match your SMTP provider. For extra
  protection against automated login attempts, enable CAPTCHA (Cloudflare Turnstile).

In **Authentication → URL Configuration**:

- **Site URL**: your production URL, e.g. `https://hr.owen-media.com`
- **Redirect URLs**: `https://hr.owen-media.com/auth/confirm` (and
  `http://localhost:3000/auth/confirm` in the development project only).

### Email templates

In **Authentication → Email Templates**, replace two templates so their links go
through the app's `/auth/confirm` route (which verifies the token on the server):

- **Invite user**: paste `supabase/templates/invite.html`
- **Reset password**: paste `supabase/templates/recovery.html`

### SMTP (required for production)

Supabase's built-in email is heavily rate limited and meant for testing only. In
**Authentication → Emails → SMTP Settings**, connect your email provider (for
example Google Workspace SMTP relay, Amazon SES, Postmark or SendGrid) using an
address such as `hr-portal@owen-media.com`.

---

## 2. Vercel

1. Import the GitHub repository into Vercel (framework preset: Next.js).
2. Add environment variables for **Production** (and separately for **Preview**,
   pointing at the development Supabase project):

   | Name | Value |
   | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | `https://<project-ref>.supabase.co` |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon or publishable key |
   | `SUPABASE_SERVICE_ROLE_KEY` | service_role or secret key (mark as **Sensitive**) |
   | `NEXT_PUBLIC_SITE_URL` | `https://hr.owen-media.com` |

3. Deploy, then add your custom domain under **Settings → Domains**.
4. Make sure the Site URL and Redirect URL in Supabase match the final domain.

---

## 3. Create the first admin

Sign-ups are off, so create the first HR admin with the service key, from a trusted
machine:

```bash
node --env-file=.env.local scripts/create-admin.mjs --email hr@owen-media.com --name "Full Name"
```

Add `--employee-code OM-001 --first-name … --last-name … --joining-date YYYY-MM-DD`
if the admin is also an employee. They receive an invite email and set their own
password. If email cannot be sent yet (Supabase's built-in email allows only a few
messages per hour), add `--print-link` to print a one-time "set your password" link
instead of emailing it. The script is safe to re-run for the same email. Everyone else is added from **Admin → Employees**.

Then, in the Admin Portal:

1. **Settings → Departments**: add departments.
2. **Settings → Leave Types**: review the default types and days.
3. **Settings → Company Information**: confirm weekend days and limits.
4. **Holidays**: add the year's holiday calendar.
5. **Employees**: add employees, then **Give portal access** to send invites.
6. **Settings → Leave Types → Allocate leave** at the start of each year.

---

## 4. Production checklist

- [ ] Separate production Supabase project; migrations applied with `npm run db:push`
- [ ] Sign-ups disabled; password policy set
- [ ] Site URL and Redirect URLs use the production domain
- [ ] Invite and reset email templates replaced; custom SMTP connected
- [ ] `payroll-documents` bucket is private
- [ ] Vercel env vars set; service role key only in `SUPABASE_SERVICE_ROLE_KEY`
- [ ] `npm test` passes on the release commit
- [ ] First admin created; test employee can see only their own data
- [ ] Backups enabled (below)

---

## 5. Backups

- **Database**: Supabase Pro and above take daily backups automatically. Enable
  **Point-in-Time Recovery** (Database → Backups) for payroll data. For an extra
  off-site copy, schedule `npx supabase db dump --linked -f backup.sql` (schema) and
  `npx supabase db dump --linked --data-only -f data.sql` to encrypted storage you control.
- **Payroll files**: database backups do **not** include Storage files. Keep the
  original PDFs from your payroll provider as the source of truth, or copy the bucket
  periodically with the Supabase S3-compatible API (Storage → S3 Connection) using
  a tool such as `rclone` to a private, encrypted location.
- Test a restore into the development project at least once a quarter.

---

## 6. Monitoring

- **Vercel → Logs**: server errors are logged as `[owen-hr] <action> failed` with an
  error code only (no personal data, tokens or document contents).
- **Supabase → Logs**: Auth, API and Postgres logs; **Advisors → Security** should
  show no warnings.
- **Admin → Audit Logs** in the app records every administrative action and sign-in.
- Optional: add an error-monitoring service (for example Sentry) and scrub request
  bodies before sending events.
