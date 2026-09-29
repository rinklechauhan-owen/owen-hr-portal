# Owen HR Portal

Employee portal and HR admin portal for Owen Media, built as a single Next.js app
on Supabase (PostgreSQL, Auth, Storage, Row Level Security).

- **Employee portal** (`/employee`): mobile-first. Leave balances, leave requests,
  calendar, holidays, payslips, YTD and PF YTD reports, profile.
- **Admin portal** (`/admin`): desktop-first. Employees, leave approvals, holidays,
  payroll uploads, reports, audit logs, settings.

No Docker is needed at any point.

## Quick start

```bash
npm install
cp .env.example .env.local   # then fill in the values
npm run dev
```

Open http://localhost:3000.

## Environment variables

| Variable | Where it comes from | Exposed to browser |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > Data API | Yes |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API Keys (anon or publishable key) | Yes (safe: RLS protects data) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API Keys (service_role or secret key) | **Never** |
| `NEXT_PUBLIC_SITE_URL` | The app's public URL, used in email links | Yes |

`.env.local` is git-ignored. Never commit it and never put the service role key in
a `NEXT_PUBLIC_` variable.

## Database

All structure lives in `supabase/migrations` (tables, constraints, indexes, RLS
policies, functions, triggers, storage bucket). Apply them to your Supabase project:

```bash
npx supabase login
npx supabase link --project-ref <your-project-ref>
npm run db:push
```

## Tests

```bash
npm test
```

- `tests/db`: runs the real migrations in an in-process Postgres (PGlite) and checks
  Row Level Security (Employee A cannot access Employee B's data), the leave
  workflow and payroll document rules.
- `tests/unit`: route protection, validation and formatting.
