-- Owen HR Portal: tables, types, constraints and indexes.
-- Business logic is in ..._functions.sql; access control is in ..._security.sql.

create extension if not exists btree_gist with schema extensions;

-- Helpers used by RLS and triggers. This schema is not exposed through the Data API.
create schema if not exists private;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------

create type public.app_role as enum ('admin', 'employee');
create type public.employee_status as enum ('active', 'inactive');
create type public.leave_status as enum ('pending', 'approved', 'rejected', 'cancelled');
create type public.notification_type as enum (
  'leave_approved',
  'leave_rejected',
  'leave_revoked',
  'payslip_available',
  'ytd_report_available',
  'pf_ytd_report_available',
  'holiday_added'
);

-- ---------------------------------------------------------------------------
-- Company settings (single row)
-- ---------------------------------------------------------------------------

create table public.app_settings (
  id boolean primary key default true check (id),
  company_name text not null default 'Owen Media'
    check (length(trim(company_name)) between 2 and 120),
  -- IANA time zone used to decide what "today" is. Servers run in UTC.
  timezone text not null default 'Asia/Kolkata',
  -- Non-working days of the week (0 = Sunday ... 6 = Saturday).
  weekend_days smallint[] not null default '{0,6}'
    check (weekend_days <@ '{0,1,2,3,4,5,6}'::smallint[]),
  max_backdate_days integer not null default 30 check (max_backdate_days between 0 and 365),
  max_advance_days integer not null default 365 check (max_advance_days between 1 and 730),
  updated_at timestamptz not null default now()
);

insert into public.app_settings (id) values (true);

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------

-- One row per login account. Created automatically when an auth user is created.
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  role public.app_role not null default 'employee',
  full_name text not null default '' check (length(full_name) <= 120),
  email text not null,
  avatar_url text check (avatar_url is null or length(avatar_url) <= 500),
  -- False when access is revoked. Kept in sync with the linked employee's status.
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profiles_role_idx on public.profiles (role) where is_active;

create table public.departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- The HR record. An employee can exist before they are given a login.
create table public.employees (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid unique references public.profiles (id) on delete set null,
  employee_code text not null unique check (employee_code ~ '^[A-Z0-9-]{2,20}$'),
  first_name text not null check (length(trim(first_name)) between 1 and 60),
  last_name text not null check (length(trim(last_name)) between 1 and 60),
  email text not null unique check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  department_id uuid references public.departments (id) on delete restrict,
  designation text check (designation is null or length(trim(designation)) between 2 and 120),
  joining_date date not null,
  status public.employee_status not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index employees_status_idx on public.employees (status);
create index employees_department_idx on public.employees (department_id);
create index employees_name_idx on public.employees (last_name, first_name);

-- ---------------------------------------------------------------------------
-- Leave
-- ---------------------------------------------------------------------------

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  name text not null unique check (length(trim(name)) between 2 and 60),
  description text check (description is null or length(description) <= 500),
  default_days numeric(4, 1) not null default 0 check (default_days between 0 and 365),
  -- False for unpaid leave: no balance is needed or deducted.
  requires_balance boolean not null default true,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.leave_balances (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  leave_type_id uuid not null references public.leave_types (id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  allocated_days numeric(5, 1) not null default 0 check (allocated_days between 0 and 365),
  -- Changed only by the leave workflow functions, in the same transaction as the
  -- request it accounts for.
  used_days numeric(5, 1) not null default 0 check (used_days >= 0),
  remaining_days numeric(5, 1) generated always as (allocated_days - used_days) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, leave_type_id, year)
);

create index leave_balances_year_idx on public.leave_balances (year);

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  leave_type_id uuid not null references public.leave_types (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  -- Working days in the range. Always calculated by the database.
  total_days numeric(4, 1) not null check (total_days > 0),
  leave_year integer generated always as (extract(year from start_date)::integer) stored,
  reason text not null check (length(trim(reason)) between 3 and 1000),
  status public.leave_status not null default 'pending',
  rejection_reason text check (rejection_reason is null or length(rejection_reason) <= 1000),
  cancellation_reason text check (cancellation_reason is null or length(cancellation_reason) <= 1000),
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint leave_requests_date_order check (end_date >= start_date),
  constraint leave_requests_single_year
    check (extract(year from start_date) = extract(year from end_date)),
  constraint leave_requests_rejection_reason
    check (status <> 'rejected' or rejection_reason is not null),
  -- No two live requests for the same employee may cover the same day, even when
  -- submitted at the same moment.
  constraint leave_requests_no_overlap exclude using gist (
    employee_id with =,
    daterange(start_date, end_date, '[]') with &&
  ) where (status in ('pending', 'approved'))
);

create index leave_requests_employee_idx on public.leave_requests (employee_id, start_date desc);
create index leave_requests_status_idx on public.leave_requests (status, start_date);
create index leave_requests_type_idx on public.leave_requests (leave_type_id);

-- ---------------------------------------------------------------------------
-- Holidays
-- ---------------------------------------------------------------------------

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(trim(name)) between 2 and 100),
  holiday_date date not null,
  description text check (description is null or length(description) <= 500),
  -- Mandatory holidays are skipped when counting leave days; optional ones are not.
  is_optional boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (holiday_date, name)
);

create index holidays_date_idx on public.holidays (holiday_date);

-- ---------------------------------------------------------------------------
-- Payroll documents. Files live in the private `payroll-documents` bucket at
-- `<employee_id>/<kind>/<file>.pdf`; these tables hold the metadata.
-- ---------------------------------------------------------------------------

create table public.payslips (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  month integer not null check (month between 1 and 12),
  year integer not null check (year between 2000 and 2100),
  file_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 255),
  file_size integer not null check (file_size between 1 and 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, year, month),
  constraint payslips_file_path_owner
    check (file_path like employee_id::text || '/payslips/%')
);

-- `year` is the first year of the financial year: 2026 = FY 2026-27 (April to March).
create table public.ytd_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  file_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 255),
  file_size integer not null check (file_size between 1 and 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, year),
  constraint ytd_reports_file_path_owner
    check (file_path like employee_id::text || '/ytd/%')
);

create table public.pf_ytd_reports (
  id uuid primary key default gen_random_uuid(),
  employee_id uuid not null references public.employees (id) on delete restrict,
  year integer not null check (year between 2000 and 2100),
  file_path text not null unique,
  file_name text not null check (length(file_name) between 1 and 255),
  file_size integer not null check (file_size between 1 and 10485760),
  uploaded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (employee_id, year),
  constraint pf_ytd_reports_file_path_owner
    check (file_path like employee_id::text || '/pf-ytd/%')
);

create index payslips_period_idx on public.payslips (year desc, month desc);
create index ytd_reports_year_idx on public.ytd_reports (year desc);
create index pf_ytd_reports_year_idx on public.pf_ytd_reports (year desc);

-- ---------------------------------------------------------------------------
-- Notifications and audit log
-- ---------------------------------------------------------------------------

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  message text not null,
  type public.notification_type not null,
  link text,
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index notifications_user_idx on public.notifications (user_id, created_at desc);
create index notifications_unread_idx on public.notifications (user_id) where not is_read;

create table public.audit_logs (
  id bigint generated always as identity primary key,
  -- Who did it (null for system actions).
  user_id uuid references public.profiles (id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id uuid,
  -- The employee the action concerns, so HR can see an employee's activity.
  subject_employee_id uuid references public.employees (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_logs_created_idx on public.audit_logs (created_at desc);
create index audit_logs_subject_idx on public.audit_logs (subject_employee_id, created_at desc);
create index audit_logs_action_idx on public.audit_logs (action, created_at desc);

-- ---------------------------------------------------------------------------
-- Balance view: adds days held by pending requests, which cannot be spent twice.
-- security_invoker keeps the caller's RLS in force.
-- ---------------------------------------------------------------------------

create view public.leave_balance_summary
with (security_invoker = true) as
select
  b.id,
  b.employee_id,
  b.leave_type_id,
  b.year,
  b.allocated_days,
  b.used_days,
  b.remaining_days,
  coalesce(p.pending_days, 0)::numeric(5, 1) as pending_days,
  (b.remaining_days - coalesce(p.pending_days, 0))::numeric(5, 1) as available_days,
  b.updated_at
from public.leave_balances b
left join lateral (
  select sum(r.total_days) as pending_days
  from public.leave_requests r
  where r.employee_id = b.employee_id
    and r.leave_type_id = b.leave_type_id
    and r.leave_year = b.year
    and r.status = 'pending'
) p on true;
