# Owen HR Portal

Employee portal and HR admin portal for Owen Media: a single Next.js application
on Supabase (PostgreSQL, Auth, Storage, Row Level Security).

| | Who | Designed for |
| --- | --- | --- |
| **Employee Portal** `/employee` | Every employee | Phones first, works on any screen |
| **Admin Portal** `/admin` | HR administrators | Desktop and tablet |

Employees view leave balances, apply for leave, track requests, see their leave and
the holiday calendar, and view or download their payslips, YTD and PF YTD reports.
HR manages employees and their access, reviews leave, manages balances and holidays,
uploads payroll documents, and reviews reports and the audit log.

No Docker is needed at any point: `npm install` and `npm run dev`.

## Tech stack

Next.js 16 (App Router, Server Components, Server Actions, Route Handlers) · React 19 ·
TypeScript · Tailwind CSS 4 · shadcn/ui · Lucide icons · Zod + React Hook Form ·
TanStack Query · Supabase (`@supabase/ssr`) · Vitest + PGlite for tests.

## Getting started

1. **Install**

   ```bash
   npm install
   ```

2. **Configure**: copy `.env.example` to `.env.local` and fill in the values from your
   Supabase project (Project Settings → API Keys).

   | Variable | Browser? | Purpose |
   | --- | --- | --- |
   | `NEXT_PUBLIC_SUPABASE_URL` | yes | Project URL |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | yes | Anon or publishable key; RLS protects the data |
   | `SUPABASE_SERVICE_ROLE_KEY` | **never** | Server-only; inviting users and blocking sign-in |
   | `NEXT_PUBLIC_SITE_URL` | yes | Base URL for invite and reset links |

3. **Create the database** (tables, RLS, functions, storage bucket):

   ```bash
   npx supabase login
   npx supabase link --project-ref <your-project-ref>
   npm run db:push
   ```

   Table access is granted explicitly in the migrations (newer Supabase projects do not
   grant it automatically). If you add a table in a future migration, grant it to
   `authenticated` and `service_role` there as well, and enable RLS.

4. **Configure Supabase Auth and create the first admin**: follow
   [docs/deployment.md](docs/deployment.md) sections 1 and 3 (disable sign-ups, set the
   redirect URL, paste the two email templates, run `scripts/create-admin.mjs`).

5. **Run**

   ```bash
   npm run dev
   ```

   Open http://localhost:3000 and log in.

## Scripts

| Command | What it does |
| --- | --- |
| `npm run dev` | Development server |
| `npm run build` / `npm start` | Production build / server |
| `npm test` | All tests (database and unit) |
| `npm run typecheck` | TypeScript |
| `npm run lint` | ESLint |
| `npm run db:push` | Apply `supabase/migrations` to the linked project |
| `npm run db:types` | Generate types from the linked project into `types/database.generated.ts` |

## Project structure

```text
app/
  (auth)/            login, forgot-password, reset-password, auth server actions
  auth/confirm/      verifies invite and reset links from email
  employee/          employee portal: dashboard, leave, calendar, holidays, salary, profile
  admin/             admin portal: dashboard, employees, leave, holidays, payroll,
                     reports, audit-logs, settings
  api/documents/     secure payroll document view/download
components/
  ui/                shadcn/ui primitives
  shared/            design-system components (PageHeader, StatCard, DataTable, EmptyState…)
  employee/ admin/   portal-specific components
  forms/             forms (React Hook Form + Zod)
lib/
  supabase/          browser, server, proxy and service-role (admin) clients
  auth/ permissions/ session loading, route rules, role guards
  validations/       Zod schemas shared by browser and server
  queries/ utils/    data loading helpers, formatting, errors
supabase/
  migrations/        the entire database: schema, functions, RLS, storage
  templates/         Auth email templates
tests/
  db/                migrations + RLS + workflow tests on in-process Postgres (PGlite)
  unit/              route protection, validation, formatting, storage paths
proxy.ts             session refresh and signed-in/out redirects (Next.js 16 "middleware")
```

## Security model

The database is the security boundary. The app's route checks only decide where
people are sent.

- **Row Level Security on every table.** Employees can read only their own profile,
  employee record, balances, leave requests, payroll documents and notifications,
  plus company holidays and leave types. Only admins can write HR data. A disabled
  employee loses all access immediately, even with a session that is still valid.
- **Leave rules live in the database.** A trigger validates every new request (dates,
  employee status, leave type, working days excluding weekends and mandatory holidays,
  overlaps, balance) and forces it to `pending`, whatever the browser sends. Approve,
  reject, revoke and cancel are database functions. Approval updates `used_days`
  in the same transaction, and `remaining_days` is computed from it. Days held by
  pending requests cannot be spent twice. An exclusion constraint blocks overlapping
  requests even when two are submitted at the same moment.
- **Guards against escalation.** Users cannot change their own role or access; the
  login ↔ employee link and `used_days` cannot be set through the API; admins cannot
  approve their own leave.
- **Payroll files** are in a private bucket under `<employee_id>/…`. Storage policies
  let employees read only their own folder and only admins write. Downloads go through
  `/api/documents/<kind>/<id>`, which loads the record with the user's own session
  (RLS) and redirects to a 60-second signed URL. Uploads use a server-chosen path and
  a one-time signed upload URL; the server then checks the size and PDF signature
  before saving.
- **Service role key**: used only in `lib/supabase/admin.ts` (marked `server-only`)
  for Supabase Auth admin tasks (invite, block/unblock sign-in, email change) and two
  service-only database functions. Never in the browser, never `NEXT_PUBLIC_`.
- **No enumeration**: login and password-reset responses never reveal whether an email
  has an account.
- **Audit log**: written only by the database (triggers and functions); nobody can edit
  or delete entries through the API. Employee changes record which fields changed,
  not their values.
- **Errors**: users see plain messages; database details are never shown. Server logs
  record an error code only.

## Leave rules

- Working days exclude the configured weekend days (default Saturday and Sunday) and
  **mandatory** holidays. Optional holidays count as working days.
- A request must fall within one calendar year; balances are per calendar year.
- Backdating (default 30 days) and advance booking (default 365 days) limits are set
  in Admin → Settings.
- The day count is fixed when a request is submitted; later holiday changes do not
  alter existing requests.
- Unpaid Leave (no balance) is never blocked by a balance.
- Employees can cancel pending requests. Admins can revoke approved leave, which
  returns the days.
- YTD and PF YTD reports use the Indian financial year (April–March): 2026 = FY 2026-27.

## Tests

```bash
npm test
```

- `tests/db`: applies the real migrations to Postgres running in-process (PGlite, no
  Docker) and checks Row Level Security (**Employee A cannot access Employee B's data**:
  profile, records, balances, requests, payslips, YTD, PF, notifications, storage files),
  admin-only actions, disabled accounts, the leave workflow (working days, invalid
  dates, insufficient balance, overlaps, approve/reject/revoke, balance updates) and
  payroll document rules.
- `tests/unit`: route protection and safe redirects, validation schemas, formatting
  and financial years, payroll storage paths.

## Deployment

See [docs/deployment.md](docs/deployment.md) for Supabase and Vercel setup, the
production checklist, backups and monitoring.
