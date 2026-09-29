-- Starting leave types. HR can rename, re-allocate, deactivate or add types in
-- Admin > Settings; these rows are initial configuration, not sample data.
insert into public.leave_types (name, description, default_days, requires_balance, sort_order)
values
  ('Casual Leave', 'Short personal leave for planned or urgent needs.', 12, true, 10),
  ('Sick Leave', 'Leave when you are unwell or need medical care.', 12, true, 20),
  ('Earned Leave', 'Paid leave earned through service, usually planned ahead.', 15, true, 30),
  ('Unpaid Leave', 'Leave without pay. Does not use a balance.', 0, false, 40)
on conflict (name) do nothing;
