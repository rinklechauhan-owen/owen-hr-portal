-- Owen HR Portal: access control.
-- Employees see only their own records. Admins manage everything.
-- RLS is the security boundary; the app's route protection is only a convenience.

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

-- Nothing for anonymous visitors.
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
revoke all on all functions in schema public from public, anon;
alter default privileges in schema public revoke all on tables from anon;
alter default privileges in schema public revoke all on sequences from anon;
alter default privileges in schema public revoke execute on functions from public, anon;

-- RLS policies call the private helpers as the requesting user.
revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;
revoke all on all functions in schema private from public, anon;
grant execute on function
  private.current_profile_id(),
  private.is_admin(),
  private.current_employee_id()
to authenticated, service_role;

-- Workflow functions for signed-in users (each checks the caller's role itself).
grant execute on function
  public.calculate_leave_days(date, date),
  public.cancel_leave_request(uuid),
  public.review_leave_request(uuid, text, text),
  public.revoke_leave_request(uuid, text),
  public.allocate_leave_for_year(integer),
  public.update_my_phone(text),
  public.get_admin_dashboard(),
  public.report_leave_summary(integer),
  public.report_payroll_status(integer, integer, integer, integer),
  public.record_sign_in()
to authenticated;

-- Trusted server-side helpers: never callable with a user's session.
revoke execute on function
  public.service_link_employee_profile(uuid, uuid, uuid),
  public.service_log_event(uuid, text, text, uuid, uuid, jsonb)
from authenticated;
grant execute on function
  public.service_link_employee_profile(uuid, uuid, uuid),
  public.service_log_event(uuid, text, text, uuid, uuid, jsonb)
to service_role;

-- Table-level limits on top of RLS.
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke insert, delete, truncate on public.app_settings from authenticated;
revoke update, delete, truncate on public.leave_requests from authenticated;
revoke delete, truncate on public.employees from authenticated;
-- Employees may only mark their notifications as read.
revoke insert, update, delete, truncate on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;

grant select on public.leave_balance_summary to authenticated;

-- ---------------------------------------------------------------------------
-- Row Level Security. (select fn()) is evaluated once per statement.
-- ---------------------------------------------------------------------------

alter table public.app_settings enable row level security;
alter table public.profiles enable row level security;
alter table public.departments enable row level security;
alter table public.employees enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_balances enable row level security;
alter table public.leave_requests enable row level security;
alter table public.holidays enable row level security;
alter table public.payslips enable row level security;
alter table public.ytd_reports enable row level security;
alter table public.pf_ytd_reports enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;

-- Settings
create policy "Signed-in users can read settings" on public.app_settings
  for select to authenticated using ((select private.current_profile_id()) is not null);
create policy "Admins can update settings" on public.app_settings
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Profiles
create policy "Users can read their own profile" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "Admins can read profiles" on public.profiles
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can update profiles" on public.profiles
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Departments
create policy "Signed-in users can read departments" on public.departments
  for select to authenticated using ((select private.current_profile_id()) is not null);
create policy "Admins can add departments" on public.departments
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update departments" on public.departments
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete departments" on public.departments
  for delete to authenticated using ((select private.is_admin()));

-- Employees (never deleted through the API; disable instead)
create policy "Employees can read their own record" on public.employees
  for select to authenticated using (id = (select private.current_employee_id()));
create policy "Admins can read employees" on public.employees
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can add employees" on public.employees
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update employees" on public.employees
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));

-- Leave types
create policy "Signed-in users can read leave types" on public.leave_types
  for select to authenticated using ((select private.current_profile_id()) is not null);
create policy "Admins can add leave types" on public.leave_types
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update leave types" on public.leave_types
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete leave types" on public.leave_types
  for delete to authenticated using ((select private.is_admin()));

-- Leave balances
create policy "Employees can read their own balances" on public.leave_balances
  for select to authenticated using (employee_id = (select private.current_employee_id()));
create policy "Admins can read balances" on public.leave_balances
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can add balances" on public.leave_balances
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update balances" on public.leave_balances
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete balances" on public.leave_balances
  for delete to authenticated using ((select private.is_admin()));

-- Leave requests: employees create their own; every change after that goes
-- through the workflow functions.
create policy "Employees can read their own leave requests" on public.leave_requests
  for select to authenticated using (employee_id = (select private.current_employee_id()));
create policy "Admins can read leave requests" on public.leave_requests
  for select to authenticated using ((select private.is_admin()));
create policy "Employees can request their own leave" on public.leave_requests
  for insert to authenticated with check (employee_id = (select private.current_employee_id()));

-- Holidays
create policy "Signed-in users can read holidays" on public.holidays
  for select to authenticated using ((select private.current_profile_id()) is not null);
create policy "Admins can add holidays" on public.holidays
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update holidays" on public.holidays
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete holidays" on public.holidays
  for delete to authenticated using ((select private.is_admin()));

-- Payroll documents (same rules for all three kinds)
create policy "Employees can read their own payslips" on public.payslips
  for select to authenticated using (employee_id = (select private.current_employee_id()));
create policy "Admins can read payslips" on public.payslips
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can add payslips" on public.payslips
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update payslips" on public.payslips
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete payslips" on public.payslips
  for delete to authenticated using ((select private.is_admin()));

create policy "Employees can read their own YTD reports" on public.ytd_reports
  for select to authenticated using (employee_id = (select private.current_employee_id()));
create policy "Admins can read YTD reports" on public.ytd_reports
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can add YTD reports" on public.ytd_reports
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update YTD reports" on public.ytd_reports
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete YTD reports" on public.ytd_reports
  for delete to authenticated using ((select private.is_admin()));

create policy "Employees can read their own PF YTD reports" on public.pf_ytd_reports
  for select to authenticated using (employee_id = (select private.current_employee_id()));
create policy "Admins can read PF YTD reports" on public.pf_ytd_reports
  for select to authenticated using ((select private.is_admin()));
create policy "Admins can add PF YTD reports" on public.pf_ytd_reports
  for insert to authenticated with check ((select private.is_admin()));
create policy "Admins can update PF YTD reports" on public.pf_ytd_reports
  for update to authenticated
  using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins can delete PF YTD reports" on public.pf_ytd_reports
  for delete to authenticated using ((select private.is_admin()));

-- Notifications
create policy "Users can read their own notifications" on public.notifications
  for select to authenticated using (user_id = (select auth.uid()));
create policy "Users can mark their own notifications read" on public.notifications
  for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Audit log
create policy "Admins can read the audit log" on public.audit_logs
  for select to authenticated using ((select private.is_admin()));

-- ---------------------------------------------------------------------------
-- Storage: private bucket, PDFs only, 10 MB max.
-- Paths: <employee_id>/<payslips|ytd|pf-ytd>/<file>.pdf
-- Employees can only read files in their own folder; only admins can write.
-- ---------------------------------------------------------------------------

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('payroll-documents', 'payroll-documents', false, 10485760, array['application/pdf'])
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy "Employees can read their own payroll files" on storage.objects
  for select to authenticated
  using (
    bucket_id = 'payroll-documents'
    and (storage.foldername(name))[1] = (select private.current_employee_id())::text
  );
create policy "Admins can read payroll files" on storage.objects
  for select to authenticated
  using (bucket_id = 'payroll-documents' and (select private.is_admin()));
create policy "Admins can upload payroll files" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'payroll-documents' and (select private.is_admin()));
create policy "Admins can replace payroll files" on storage.objects
  for update to authenticated
  using (bucket_id = 'payroll-documents' and (select private.is_admin()))
  with check (bucket_id = 'payroll-documents' and (select private.is_admin()));
create policy "Admins can delete payroll files" on storage.objects
  for delete to authenticated
  using (bucket_id = 'payroll-documents' and (select private.is_admin()));
