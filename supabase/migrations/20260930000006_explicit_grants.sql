-- Owen HR Portal: explicit table privileges.
-- Newer Supabase projects do not grant the API roles access to tables created by
-- migrations, so grant exactly what the app needs instead of relying on project
-- defaults. Row Level Security still decides which rows each user can touch.
-- Future migrations that add tables must add their grants here too.

grant usage on schema public to authenticated, service_role;

-- Signed-in users: normal DML, limited by RLS and the revokes below.
grant select, insert, update, delete on all tables in schema public to authenticated;

-- Service role: used only by trusted server code (see lib/supabase/admin.ts).
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;

-- Re-apply the table-level limits from 20260930000003_security.sql.
revoke insert, update, delete, truncate on public.audit_logs from authenticated;
revoke insert, delete, truncate on public.profiles from authenticated;
revoke insert, delete, truncate on public.app_settings from authenticated;
revoke update, delete, truncate on public.leave_requests from authenticated;
revoke delete, truncate on public.employees from authenticated;
revoke insert, update, delete, truncate on public.notifications from authenticated;
grant update (is_read) on public.notifications to authenticated;
-- The balance view is read-only.
revoke insert, update, delete, truncate on public.leave_balance_summary from authenticated;

-- Anonymous visitors get nothing (repeated here in case project defaults change).
revoke all on all tables in schema public from anon;
