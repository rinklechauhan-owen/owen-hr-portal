-- Owen HR Portal: hardening from the security review.
-- * Admins cannot change their own leave balances (separation of duties, like
--   reviewing their own leave).
-- * New leave requests always get a database-generated id and timestamps.
-- * Sign-in audit entries are throttled to one per user per minute.

create or replace function private.guard_leave_balance_changes()
returns trigger
language plpgsql set search_path = ''
as $$
declare
  v_row public.leave_balances := coalesce(new, old);
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
  end if;
  -- Separation of duties: admins cannot change their own leave balances.
  if exists (
    select 1 from public.employees e
    where e.id in (v_row.employee_id, old.employee_id) and e.profile_id = auth.uid()
  ) then
    raise exception 'You cannot change your own leave balance. Ask another administrator.';
  end if;
  if tg_op = 'INSERT' then
    if new.used_days <> 0 then
      raise exception 'Used days are calculated from approved leave and cannot be set directly.';
    end if;
    return new;
  end if;
  if tg_op = 'DELETE' then
    if old.used_days > 0 or exists (
      select 1 from public.leave_requests r
      where r.employee_id = old.employee_id and r.leave_type_id = old.leave_type_id
        and r.leave_year = old.year and r.status = 'pending'
    ) then
      raise exception 'This balance has leave recorded against it and cannot be removed.';
    end if;
    return old;
  end if;
  if new.used_days is distinct from old.used_days then
    raise exception 'Used days are calculated from approved leave and cannot be set directly.';
  end if;
  if new.employee_id is distinct from old.employee_id
     or new.leave_type_id is distinct from old.leave_type_id
     or new.year is distinct from old.year then
    raise exception 'Create a new balance instead of moving an existing one.';
  end if;
  return new;
end;
$$;

create or replace function private.prepare_leave_request()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_employee public.employees;
  v_type public.leave_types;
  v_settings public.app_settings;
  v_today date := private.today();
  v_balance public.leave_balances;
  v_pending numeric;
  v_available numeric;
begin
  -- BEFORE triggers run ahead of RLS checks, so confirm ownership first. Otherwise
  -- the validation messages below could reveal another employee's leave.
  if coalesce(auth.jwt() ->> 'role', '') = 'authenticated'
     and new.employee_id is distinct from private.current_employee_id() then
    raise exception 'You can only request leave for yourself.';
  end if;

  -- Only the workflow and the database may set these.
  new.id := gen_random_uuid();
  new.created_at := now();
  new.updated_at := now();
  new.status := 'pending';
  new.rejection_reason := null;
  new.cancellation_reason := null;
  new.reviewed_by := null;
  new.reviewed_at := null;
  new.cancelled_at := null;
  new.reason := trim(coalesce(new.reason, ''));

  select * into v_employee from public.employees where id = new.employee_id;
  if not found or v_employee.status <> 'active' then
    raise exception 'Leave can only be requested for an active employee.';
  end if;

  select * into v_type from public.leave_types where id = new.leave_type_id;
  if not found or not v_type.is_active then
    raise exception 'Please choose a valid leave type.';
  end if;

  if new.start_date is null or new.end_date is null then
    raise exception 'Start and end dates are required.';
  end if;
  if new.end_date < new.start_date then
    raise exception 'End date cannot be before start date.';
  end if;
  if extract(year from new.start_date) <> extract(year from new.end_date) then
    raise exception 'Leave cannot span two calendar years. Please submit a separate request for each year.';
  end if;
  if length(new.reason) < 3 then
    raise exception 'Please enter a reason for your leave.';
  end if;
  if length(new.reason) > 1000 then
    raise exception 'The reason must be 1000 characters or fewer.';
  end if;

  select * into v_settings from public.app_settings;
  if new.start_date < v_today - v_settings.max_backdate_days then
    raise exception 'Leave can be backdated by at most % days.', v_settings.max_backdate_days;
  end if;
  if new.end_date > v_today + v_settings.max_advance_days then
    raise exception 'Leave can be requested at most % days in advance.', v_settings.max_advance_days;
  end if;

  new.total_days := private.working_days_between(new.start_date, new.end_date);
  if new.total_days = 0 then
    raise exception 'The selected dates fall on weekends or holidays, so no leave is needed.';
  end if;

  if exists (
    select 1 from public.leave_requests r
    where r.employee_id = new.employee_id
      and r.status in ('pending', 'approved')
      and daterange(r.start_date, r.end_date, '[]') && daterange(new.start_date, new.end_date, '[]')
  ) then
    raise exception 'You already have a leave request that overlaps these dates.';
  end if;

  if v_type.requires_balance then
    -- Lock the balance so two submissions at once cannot spend the same days.
    select * into v_balance
    from public.leave_balances
    where employee_id = new.employee_id
      and leave_type_id = new.leave_type_id
      and year = extract(year from new.start_date)::integer
    for update;
    if not found then
      raise exception 'You have no % balance for %. Please contact HR.',
        v_type.name, extract(year from new.start_date);
    end if;

    select coalesce(sum(r.total_days), 0) into v_pending
    from public.leave_requests r
    where r.employee_id = new.employee_id
      and r.leave_type_id = new.leave_type_id
      and r.leave_year = v_balance.year
      and r.status = 'pending';

    v_available := v_balance.remaining_days - v_pending;
    if new.total_days > v_available then
      raise exception 'Not enough % balance. This request needs % day(s) and you have % available.',
        v_type.name, trim_scale(new.total_days), trim_scale(greatest(v_available, 0));
    end if;
  end if;

  return new;
end;
$$;


create or replace function public.record_sign_in()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_employee_id uuid;
begin
  if private.current_profile_id() is null then
    return;
  end if;
  -- At most one entry a minute per user, so the log cannot be flooded.
  if exists (
    select 1 from public.audit_logs a
    where a.action = 'auth.signed_in' and a.user_id = auth.uid()
      and a.created_at > now() - interval '1 minute'
  ) then
    return;
  end if;
  select e.id into v_employee_id from public.employees e where e.profile_id = auth.uid();
  perform private.log_event('auth.signed_in', 'profile', auth.uid(), v_employee_id);
end;
$$;
