-- Owen HR Portal: business logic, triggers and the leave workflow.
--
-- Conventions
-- * Every function sets an empty search_path and uses fully-qualified names.
-- * User-facing errors are raised with the default SQLSTATE P0001 and a plain-English
--   message. The app shows P0001 messages as-is and hides every other database error.
-- * Guard triggers are SECURITY INVOKER and act only when current_user = 'authenticated',
--   i.e. a direct Data API call. Workflow functions are SECURITY DEFINER, so the
--   statements they run are trusted and pass the guards.

-- ---------------------------------------------------------------------------
-- Identity helpers (used by RLS policies)
-- ---------------------------------------------------------------------------

-- The signed-in user's profile id, when their access is active.
create function private.current_profile_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.id from public.profiles p where p.id = auth.uid() and p.is_active;
$$;

create function private.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.is_active and p.role = 'admin'
  );
$$;

-- The signed-in user's employee id, when both the login and the employee are active.
create function private.current_employee_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select e.id
  from public.employees e
  join public.profiles p on p.id = e.profile_id
  where p.id = auth.uid() and p.is_active and e.status = 'active';
$$;

-- "Today" in the company's time zone (servers run in UTC).
create function private.today()
returns date
language sql stable security definer set search_path = ''
as $$
  select (now() at time zone s.timezone)::date from public.app_settings s;
$$;

create function private.employee_name(p_employee_id uuid)
returns text
language sql stable security definer set search_path = ''
as $$
  select e.first_name || ' ' || e.last_name from public.employees e where e.id = p_employee_id;
$$;

-- ---------------------------------------------------------------------------
-- Audit log and notifications
-- ---------------------------------------------------------------------------

-- The acting user: the JWT subject, or the admin a trusted server action named.
create function private.actor_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select coalesce(auth.uid(), nullif(current_setting('owen.actor_id', true), '')::uuid);
$$;

create function private.log_event(
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_subject_employee_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.audit_logs (user_id, action, entity_type, entity_id, subject_employee_id, metadata)
  values (
    (select p.id from public.profiles p where p.id = private.actor_id()),
    p_action,
    p_entity_type,
    p_entity_id,
    p_subject_employee_id,
    coalesce(p_metadata, '{}'::jsonb)
  );
$$;

create function private.notify_employee(
  p_employee_id uuid,
  p_type public.notification_type,
  p_title text,
  p_message text,
  p_link text default null
)
returns void
language sql security definer set search_path = ''
as $$
  insert into public.notifications (user_id, type, title, message, link)
  select e.profile_id, p_type, p_title, p_message, p_link
  from public.employees e
  where e.id = p_employee_id and e.profile_id is not null;
$$;

-- Names of the columns that differ between two row images, ignoring bookkeeping columns.
create function private.changed_fields(p_old jsonb, p_new jsonb)
returns text[]
language sql immutable set search_path = ''
as $$
  select coalesce(array_agg(k order by k), '{}')
  from jsonb_object_keys(p_new) k
  where k not in ('updated_at', 'created_at') and p_new -> k is distinct from p_old -> k;
$$;

-- ---------------------------------------------------------------------------
-- Auth user -> profile
-- ---------------------------------------------------------------------------

-- Role comes from app_metadata, which only the service role can set.
create function private.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name, role)
  values (
    new.id,
    lower(coalesce(new.email, '')),
    coalesce(new.raw_user_meta_data ->> 'full_name', ''),
    case when new.raw_app_meta_data ->> 'role' = 'admin' then 'admin'::public.app_role
         else 'employee'::public.app_role end
  );
  return new;
end;
$$;

create function private.handle_user_email_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.profiles set email = lower(coalesce(new.email, '')) where id = new.id;
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Generic triggers
-- ---------------------------------------------------------------------------

create function private.set_updated_at()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Guards (SECURITY INVOKER on purpose: see header)
-- ---------------------------------------------------------------------------

create function private.guard_profile_changes()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if new.id is distinct from old.id or new.email is distinct from old.email then
    raise exception 'This field cannot be changed here.';
  end if;
  if new.role is distinct from old.role or new.is_active is distinct from old.is_active then
    if old.id = auth.uid() then
      raise exception 'You cannot change your own role or access.';
    end if;
  end if;
  if new.is_active is distinct from old.is_active
     and exists (select 1 from public.employees e where e.profile_id = old.id) then
    raise exception 'Change access for employees by enabling or disabling the employee.';
  end if;
  return new;
end;
$$;

create function private.guard_employee_changes()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return new;
  end if;
  if tg_op = 'INSERT' then
    if new.profile_id is not null then
      raise exception 'Portal access is granted separately after the employee is created.';
    end if;
    return new;
  end if;
  if new.profile_id is distinct from old.profile_id then
    raise exception 'Portal access is managed from the employee''s access settings.';
  end if;
  if new.status is distinct from old.status and old.profile_id = auth.uid() then
    raise exception 'You cannot disable your own account.';
  end if;
  return new;
end;
$$;

create function private.guard_leave_balance_changes()
returns trigger
language plpgsql set search_path = ''
as $$
begin
  if current_user <> 'authenticated' then
    return coalesce(new, old);
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

-- ---------------------------------------------------------------------------
-- Employee side effects
-- ---------------------------------------------------------------------------

-- Keep the linked login's access and display name in step with the employee record.
create function private.sync_employee_profile()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.profile_id is not null then
    update public.profiles
    set is_active = (new.status = 'active'),
        full_name = new.first_name || ' ' || new.last_name
    where id = new.profile_id
      and (is_active is distinct from (new.status = 'active')
           or full_name is distinct from new.first_name || ' ' || new.last_name);
  end if;
  if tg_op = 'UPDATE' and old.profile_id is not null
     and old.profile_id is distinct from new.profile_id then
    update public.profiles set is_active = false where id = old.profile_id;
  end if;
  return null;
end;
$$;

create function private.create_default_balances()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.leave_balances (employee_id, leave_type_id, year, allocated_days)
  select new.id, t.id, extract(year from private.today())::integer, t.default_days
  from public.leave_types t
  where t.is_active and t.requires_balance
  on conflict (employee_id, leave_type_id, year) do nothing;
  return null;
end;
$$;

create function private.audit_employee()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_meta jsonb := jsonb_build_object(
    'employee_code', new.employee_code,
    'name', new.first_name || ' ' || new.last_name
  );
  v_fields text[];
begin
  if tg_op = 'INSERT' then
    perform private.log_event('employee.created', 'employee', new.id, new.id, v_meta);
    return null;
  end if;

  if new.status is distinct from old.status then
    perform private.log_event(
      case new.status when 'inactive' then 'employee.disabled' else 'employee.enabled' end,
      'employee', new.id, new.id, v_meta);
  end if;
  if new.profile_id is not null and old.profile_id is distinct from new.profile_id then
    perform private.log_event('employee.access_granted', 'employee', new.id, new.id, v_meta);
  end if;

  -- Field names only: values may be personal data.
  v_fields := array(
    select f from unnest(private.changed_fields(to_jsonb(old), to_jsonb(new))) f
    where f not in ('status', 'profile_id')
  );
  if cardinality(v_fields) > 0 then
    perform private.log_event('employee.updated', 'employee', new.id, new.id,
      v_meta || jsonb_build_object('changed_fields', to_jsonb(v_fields)));
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Audit triggers for HR-managed reference data
-- ---------------------------------------------------------------------------

-- TG_ARGV[0] is the entity name used in the action, e.g. 'holiday' -> 'holiday.created'.
create function private.audit_reference_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_entity text := tg_argv[0];
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_meta jsonb;
  v_fields text[];
  v_subject uuid;
begin
  v_meta := case tg_table_name
    when 'holidays' then jsonb_build_object('name', v_row ->> 'name', 'date', v_row ->> 'holiday_date')
    when 'leave_types' then jsonb_build_object('name', v_row ->> 'name')
    when 'departments' then jsonb_build_object('name', v_row ->> 'name')
    when 'leave_balances' then jsonb_build_object(
      'leave_type', (select t.name from public.leave_types t where t.id = (v_row ->> 'leave_type_id')::uuid),
      'year', (v_row ->> 'year')::integer,
      'allocated_days', (v_row ->> 'allocated_days')::numeric)
    else '{}'::jsonb
  end;

  if tg_table_name = 'leave_balances' then
    v_subject := (v_row ->> 'employee_id')::uuid;
  end if;

  if tg_op = 'UPDATE' then
    v_fields := private.changed_fields(to_jsonb(old), to_jsonb(new));
    if cardinality(v_fields) = 0 then
      return null;
    end if;
    -- used_days changes are logged by the leave workflow itself.
    if tg_table_name = 'leave_balances' and v_fields = array['remaining_days', 'used_days'] then
      return null;
    end if;
    v_meta := v_meta || jsonb_build_object('changed_fields', to_jsonb(v_fields));
    if tg_table_name = 'leave_balances' then
      v_meta := v_meta || jsonb_build_object('previous_allocated_days', old.allocated_days);
    end if;
  end if;

  perform private.log_event(
    v_entity || '.' || case tg_op when 'INSERT' then 'created' when 'UPDATE' then 'updated' else 'deleted' end,
    v_entity,
    case when (v_row ->> 'id') ~ '^[0-9a-f-]{36}$' then (v_row ->> 'id')::uuid end,
    v_subject,
    v_meta
  );
  return null;
end;
$$;

-- Tell every active employee about a new upcoming holiday.
create function private.notify_holiday_added()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.holiday_date >= private.today() then
    insert into public.notifications (user_id, type, title, message, link)
    select p.id, 'holiday_added', 'Holiday added',
      new.name || ' on ' || to_char(new.holiday_date, 'FMDD Mon YYYY')
        || case when new.is_optional then ' (optional)' else '' end,
      '/employee/holidays'
    from public.employees e
    join public.profiles p on p.id = e.profile_id
    where e.status = 'active' and p.is_active;
  end if;
  return null;
end;
$$;

-- Payroll documents: audit + notify the employee. Kind comes from the table name.
create function private.handle_payroll_document_change()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_row jsonb := to_jsonb(coalesce(new, old));
  v_entity text;
  v_label text;
  v_type public.notification_type;
  v_link text;
  v_period text;
begin
  case tg_table_name
    when 'payslips' then
      v_entity := 'payslip'; v_label := 'payslip'; v_type := 'payslip_available';
      v_link := '/employee/salary/payslips';
      v_period := to_char(make_date((v_row ->> 'year')::integer, (v_row ->> 'month')::integer, 1), 'FMMonth YYYY');
    when 'ytd_reports' then
      v_entity := 'ytd_report'; v_label := 'YTD report'; v_type := 'ytd_report_available';
      v_link := '/employee/salary/ytd';
      v_period := 'FY ' || (v_row ->> 'year') || '-' || right(((v_row ->> 'year')::integer + 1)::text, 2);
    else
      v_entity := 'pf_ytd_report'; v_label := 'PF YTD report'; v_type := 'pf_ytd_report_available';
      v_link := '/employee/salary/pf-ytd';
      v_period := 'FY ' || (v_row ->> 'year') || '-' || right(((v_row ->> 'year')::integer + 1)::text, 2);
  end case;

  if tg_op = 'UPDATE' and new.file_path is not distinct from old.file_path then
    return null;
  end if;

  perform private.log_event(
    v_entity || '.' || case tg_op when 'INSERT' then 'uploaded' when 'UPDATE' then 'replaced' else 'deleted' end,
    v_entity,
    (v_row ->> 'id')::uuid,
    (v_row ->> 'employee_id')::uuid,
    jsonb_build_object('period', v_period, 'file_name', v_row ->> 'file_name')
  );

  if tg_op in ('INSERT', 'UPDATE') then
    perform private.notify_employee(
      new.employee_id,
      v_type,
      'New ' || v_label || ' available',
      'Your ' || v_label || ' for ' || v_period || ' is ready to view.',
      v_link
    );
  end if;
  return null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Leave calculations
-- ---------------------------------------------------------------------------

-- Working days in [p_start, p_end]: skips configured weekend days and mandatory holidays.
create function private.working_days_between(p_start date, p_end date)
returns integer
language sql stable security definer set search_path = ''
as $$
  select count(*)::integer
  from generate_series(p_start, p_end, interval '1 day') as d (day)
  cross join public.app_settings s
  where not (extract(dow from d.day)::smallint = any (s.weekend_days))
    and not exists (
      select 1 from public.holidays h
      where h.holiday_date = d.day::date and not h.is_optional
    );
$$;

-- Preview for the leave form. The real value is recalculated when the request is saved.
create function public.calculate_leave_days(p_start_date date, p_end_date date)
returns integer
language plpgsql stable security definer set search_path = ''
as $$
begin
  if private.current_employee_id() is null then
    raise exception 'Your account is not active. Please contact HR.';
  end if;
  if p_start_date is null or p_end_date is null or p_end_date < p_start_date then
    return 0;
  end if;
  if p_end_date - p_start_date > 366 then
    raise exception 'The date range is too long.';
  end if;
  return private.working_days_between(p_start_date, p_end_date);
end;
$$;

-- ---------------------------------------------------------------------------
-- Leave workflow
-- ---------------------------------------------------------------------------

-- Validates and completes every new leave request. Employees insert their own
-- requests (RLS checks ownership); this trigger makes sure nothing they send can
-- skip the rules or pre-approve itself.
create function private.prepare_leave_request()
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

  -- Only the workflow may set these.
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

create function private.audit_leave_submitted()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  perform private.log_event('leave.submitted', 'leave_request', new.id, new.employee_id,
    jsonb_build_object(
      'leave_type', (select t.name from public.leave_types t where t.id = new.leave_type_id),
      'start_date', new.start_date, 'end_date', new.end_date, 'total_days', new.total_days));
  return null;
end;
$$;

-- Employees can withdraw their own pending requests.
create function public.cancel_leave_request(p_request_id uuid)
returns public.leave_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_employee_id uuid := private.current_employee_id();
  v_request public.leave_requests;
begin
  if v_employee_id is null then
    raise exception 'Your account is not active. Please contact HR.';
  end if;

  select * into v_request
  from public.leave_requests
  where id = p_request_id and employee_id = v_employee_id
  for update;
  if not found then
    raise exception 'Leave request not found.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'Only pending requests can be cancelled. Please contact HR about approved leave.';
  end if;

  update public.leave_requests
  set status = 'cancelled', cancelled_at = now()
  where id = p_request_id
  returning * into v_request;

  perform private.log_event('leave.cancelled', 'leave_request', v_request.id, v_employee_id,
    jsonb_build_object('start_date', v_request.start_date, 'end_date', v_request.end_date));
  return v_request;
end;
$$;

-- Approve or reject a pending request. Approval deducts the balance in the same
-- transaction, so a request can never be approved without its days being counted.
create function public.review_leave_request(
  p_request_id uuid,
  p_decision text,
  p_rejection_reason text default null
)
returns public.leave_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.leave_requests;
  v_type public.leave_types;
  v_employee public.employees;
  v_balance public.leave_balances;
  v_reason text := nullif(trim(coalesce(p_rejection_reason, '')), '');
  v_period text;
begin
  if not private.is_admin() then
    raise exception 'Only HR administrators can review leave requests.';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'Choose approve or reject.';
  end if;

  select * into v_request from public.leave_requests where id = p_request_id for update;
  if not found then
    raise exception 'Leave request not found.';
  end if;
  if v_request.status <> 'pending' then
    raise exception 'This request has already been %.', v_request.status;
  end if;

  select * into v_employee from public.employees where id = v_request.employee_id;
  if v_employee.profile_id = auth.uid() then
    raise exception 'You cannot review your own leave request. Ask another administrator.';
  end if;

  select * into v_type from public.leave_types where id = v_request.leave_type_id;
  v_period := to_char(v_request.start_date, 'FMDD Mon YYYY')
    || case when v_request.end_date > v_request.start_date
            then ' to ' || to_char(v_request.end_date, 'FMDD Mon YYYY') else '' end;

  if p_decision = 'approved' then
    if v_type.requires_balance then
      select * into v_balance
      from public.leave_balances
      where employee_id = v_request.employee_id
        and leave_type_id = v_request.leave_type_id
        and year = v_request.leave_year
      for update;
      if not found then
        raise exception '% has no % balance for %. Allocate a balance before approving.',
          v_employee.first_name || ' ' || v_employee.last_name, v_type.name, v_request.leave_year;
      end if;
      if v_balance.used_days + v_request.total_days > v_balance.allocated_days then
        raise exception 'Approving would exceed the % balance (% of % day(s) already used). Adjust the balance first.',
          v_type.name, trim_scale(v_balance.used_days), trim_scale(v_balance.allocated_days);
      end if;
      update public.leave_balances
      set used_days = used_days + v_request.total_days
      where id = v_balance.id;
    end if;

    update public.leave_requests
    set status = 'approved', reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id
    returning * into v_request;

    perform private.notify_employee(v_request.employee_id, 'leave_approved', 'Leave approved',
      'Your ' || v_type.name || ' for ' || v_period || ' has been approved.', '/employee/leave/history');
  else
    if v_reason is null then
      raise exception 'Please enter a reason for rejecting this request.';
    end if;
    if length(v_reason) > 1000 then
      raise exception 'The rejection reason must be 1000 characters or fewer.';
    end if;

    update public.leave_requests
    set status = 'rejected', rejection_reason = v_reason, reviewed_by = auth.uid(), reviewed_at = now()
    where id = p_request_id
    returning * into v_request;

    perform private.notify_employee(v_request.employee_id, 'leave_rejected', 'Leave rejected',
      'Your ' || v_type.name || ' for ' || v_period || ' was not approved.', '/employee/leave/history');
  end if;

  perform private.log_event('leave.' || p_decision, 'leave_request', v_request.id, v_request.employee_id,
    jsonb_build_object('leave_type', v_type.name, 'start_date', v_request.start_date,
      'end_date', v_request.end_date, 'total_days', v_request.total_days));
  return v_request;
end;
$$;

-- Admins can revoke approved leave; the days go back to the balance.
create function public.revoke_leave_request(p_request_id uuid, p_reason text)
returns public.leave_requests
language plpgsql security definer set search_path = ''
as $$
declare
  v_request public.leave_requests;
  v_type public.leave_types;
  v_employee public.employees;
  v_reason text := nullif(trim(coalesce(p_reason, '')), '');
begin
  if not private.is_admin() then
    raise exception 'Only HR administrators can revoke leave.';
  end if;
  if v_reason is null then
    raise exception 'Please enter a reason for revoking this leave.';
  end if;
  if length(v_reason) > 1000 then
    raise exception 'The reason must be 1000 characters or fewer.';
  end if;

  select * into v_request from public.leave_requests where id = p_request_id for update;
  if not found then
    raise exception 'Leave request not found.';
  end if;
  if v_request.status <> 'approved' then
    raise exception 'Only approved leave can be revoked.';
  end if;

  select * into v_employee from public.employees where id = v_request.employee_id;
  if v_employee.profile_id = auth.uid() then
    raise exception 'You cannot revoke your own leave. Ask another administrator.';
  end if;

  select * into v_type from public.leave_types where id = v_request.leave_type_id;
  if v_type.requires_balance then
    update public.leave_balances
    set used_days = greatest(used_days - v_request.total_days, 0)
    where employee_id = v_request.employee_id
      and leave_type_id = v_request.leave_type_id
      and year = v_request.leave_year;
  end if;

  update public.leave_requests
  set status = 'cancelled', cancellation_reason = v_reason, cancelled_at = now(),
      reviewed_by = auth.uid(), reviewed_at = now()
  where id = p_request_id
  returning * into v_request;

  perform private.notify_employee(v_request.employee_id, 'leave_revoked', 'Leave revoked',
    'Your approved ' || v_type.name || ' starting ' || to_char(v_request.start_date, 'FMDD Mon YYYY')
      || ' has been revoked by HR.', '/employee/leave/history');

  perform private.log_event('leave.revoked', 'leave_request', v_request.id, v_request.employee_id,
    jsonb_build_object('leave_type', v_type.name, 'start_date', v_request.start_date,
      'end_date', v_request.end_date, 'total_days', v_request.total_days));
  return v_request;
end;
$$;

-- Creates missing balances for every active employee and balance-tracked leave type.
create function public.allocate_leave_for_year(p_year integer)
returns integer
language plpgsql security definer set search_path = ''
as $$
declare
  v_this_year integer := extract(year from private.today())::integer;
  v_count integer;
begin
  if not private.is_admin() then
    raise exception 'Only HR administrators can allocate leave.';
  end if;
  if p_year is null or p_year not between v_this_year - 1 and v_this_year + 1 then
    raise exception 'Leave can only be allocated for last year, this year or next year.';
  end if;

  insert into public.leave_balances (employee_id, leave_type_id, year, allocated_days)
  select e.id, t.id, p_year, t.default_days
  from public.employees e
  cross join public.leave_types t
  where e.status = 'active' and t.is_active and t.requires_balance
  on conflict (employee_id, leave_type_id, year) do nothing;
  get diagnostics v_count = row_count;

  perform private.log_event('leave_balance.bulk_allocated', 'leave_balance', null, null,
    jsonb_build_object('year', p_year, 'created', v_count));
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- Employee self-service
-- ---------------------------------------------------------------------------

-- Phone is the only field employees may edit themselves.
create function public.update_my_phone(p_phone text)
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_employee_id uuid := private.current_employee_id();
  v_phone text := nullif(trim(coalesce(p_phone, '')), '');
begin
  if v_employee_id is null then
    raise exception 'Your account is not active. Please contact HR.';
  end if;
  if v_phone is not null and v_phone !~ '^\+?[0-9 ()-]{7,20}$' then
    raise exception 'Enter a valid phone number.';
  end if;
  update public.employees set phone = v_phone where id = v_employee_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin dashboard and reports
-- ---------------------------------------------------------------------------

create function public.get_admin_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_today date := private.today();
begin
  if not private.is_admin() then
    raise exception 'Only HR administrators can view the dashboard.';
  end if;

  return jsonb_build_object(
    'total_employees', (select count(*) from public.employees),
    'active_employees', (select count(*) from public.employees where status = 'active'),
    'employees_without_access',
      (select count(*) from public.employees where status = 'active' and profile_id is null),
    'pending_requests', (select count(*) from public.leave_requests where status = 'pending'),
    'approved_this_month', (
      select count(*) from public.leave_requests
      where status = 'approved'
        and start_date <= (date_trunc('month', v_today) + interval '1 month - 1 day')::date
        and end_date >= date_trunc('month', v_today)::date
    ),
    'on_leave_today', (
      select count(distinct employee_id) from public.leave_requests
      where status = 'approved' and v_today between start_date and end_date
    ),
    'upcoming_holidays', (
      select count(*) from public.holidays where holiday_date between v_today and v_today + 90
    ),
    'payroll_documents', (
      (select count(*) from public.payslips)
      + (select count(*) from public.ytd_reports)
      + (select count(*) from public.pf_ytd_reports)
    )
  );
end;
$$;

-- Per leave type totals for a year.
create function public.report_leave_summary(p_year integer)
returns table (
  leave_type_id uuid,
  leave_type text,
  requires_balance boolean,
  employees integer,
  allocated_days numeric,
  used_days numeric,
  pending_days numeric,
  approved_requests integer,
  rejected_requests integer
)
language plpgsql stable security definer set search_path = ''
as $$
begin
  if not private.is_admin() then
    raise exception 'Only HR administrators can view reports.';
  end if;

  return query
  select
    t.id,
    t.name,
    t.requires_balance,
    (select count(*)::integer from public.leave_balances b where b.leave_type_id = t.id and b.year = p_year),
    coalesce((select sum(b.allocated_days) from public.leave_balances b
              where b.leave_type_id = t.id and b.year = p_year), 0),
    coalesce((select sum(r.total_days) from public.leave_requests r
              where r.leave_type_id = t.id and r.leave_year = p_year and r.status = 'approved'), 0),
    coalesce((select sum(r.total_days) from public.leave_requests r
              where r.leave_type_id = t.id and r.leave_year = p_year and r.status = 'pending'), 0),
    (select count(*)::integer from public.leave_requests r
     where r.leave_type_id = t.id and r.leave_year = p_year and r.status = 'approved'),
    (select count(*)::integer from public.leave_requests r
     where r.leave_type_id = t.id and r.leave_year = p_year and r.status = 'rejected')
  from public.leave_types t
  order by t.sort_order, t.name;
end;
$$;

-- Which active employees have their documents for a payslip month.
-- The YTD columns use the financial year that month belongs to.
create function public.report_payroll_status(
  p_year integer,
  p_month integer,
  p_limit integer default 25,
  p_offset integer default 0
)
returns table (
  employee_id uuid,
  employee_code text,
  full_name text,
  department text,
  has_payslip boolean,
  has_ytd_report boolean,
  has_pf_ytd_report boolean,
  total_count bigint
)
language plpgsql stable security definer set search_path = ''
as $$
declare
  v_fy integer := case when p_month >= 4 then p_year else p_year - 1 end;
begin
  if not private.is_admin() then
    raise exception 'Only HR administrators can view reports.';
  end if;
  if p_month not between 1 and 12 then
    raise exception 'Choose a valid month.';
  end if;

  return query
  select
    e.id,
    e.employee_code,
    e.first_name || ' ' || e.last_name,
    d.name,
    exists (select 1 from public.payslips s where s.employee_id = e.id and s.year = p_year and s.month = p_month),
    exists (select 1 from public.ytd_reports y where y.employee_id = e.id and y.year = v_fy),
    exists (select 1 from public.pf_ytd_reports f where f.employee_id = e.id and f.year = v_fy),
    count(*) over ()
  from public.employees e
  left join public.departments d on d.id = e.department_id
  where e.status = 'active'
  order by e.last_name, e.first_name
  limit least(greatest(p_limit, 1), 100)
  offset greatest(p_offset, 0);
end;
$$;

create function public.record_sign_in()
returns void
language plpgsql security definer set search_path = ''
as $$
declare
  v_employee_id uuid;
begin
  if private.current_profile_id() is null then
    return;
  end if;
  select e.id into v_employee_id from public.employees e where e.profile_id = auth.uid();
  perform private.log_event('auth.signed_in', 'profile', auth.uid(), v_employee_id);
end;
$$;

-- ---------------------------------------------------------------------------
-- Trusted server actions (service role only)
-- ---------------------------------------------------------------------------

-- Links a newly invited login to an employee, attributing the change to the admin.
create function public.service_link_employee_profile(
  p_employee_id uuid,
  p_profile_id uuid,
  p_actor_id uuid
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('owen.actor_id', coalesce(p_actor_id::text, ''), true);
  update public.employees set profile_id = p_profile_id where id = p_employee_id;
  if not found then
    raise exception 'Employee not found.';
  end if;
end;
$$;

-- Records an admin action performed through the Auth admin API.
create function public.service_log_event(
  p_actor_id uuid,
  p_action text,
  p_entity_type text,
  p_entity_id uuid,
  p_subject_employee_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql security definer set search_path = ''
as $$
begin
  perform set_config('owen.actor_id', coalesce(p_actor_id::text, ''), true);
  perform private.log_event(p_action, p_entity_type, p_entity_id, p_subject_employee_id, p_metadata);
end;
$$;

-- ---------------------------------------------------------------------------
-- Triggers
-- ---------------------------------------------------------------------------

create trigger on_auth_user_created after insert on auth.users
  for each row execute function private.handle_new_user();
create trigger on_auth_user_email_changed after update of email on auth.users
  for each row execute function private.handle_user_email_change();

create trigger set_updated_at before update on public.app_settings
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.profiles
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.departments
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.employees
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.leave_types
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.leave_balances
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.leave_requests
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.holidays
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.payslips
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.ytd_reports
  for each row execute function private.set_updated_at();
create trigger set_updated_at before update on public.pf_ytd_reports
  for each row execute function private.set_updated_at();

create trigger guard_profile_changes before update on public.profiles
  for each row execute function private.guard_profile_changes();
create trigger guard_employee_changes before insert or update on public.employees
  for each row execute function private.guard_employee_changes();
create trigger guard_leave_balance_changes before insert or update or delete on public.leave_balances
  for each row execute function private.guard_leave_balance_changes();

create trigger sync_employee_profile after insert or update on public.employees
  for each row execute function private.sync_employee_profile();
create trigger create_default_balances after insert on public.employees
  for each row execute function private.create_default_balances();
create trigger audit_employee after insert or update on public.employees
  for each row execute function private.audit_employee();

create trigger prepare_leave_request before insert on public.leave_requests
  for each row execute function private.prepare_leave_request();
create trigger audit_leave_submitted after insert on public.leave_requests
  for each row execute function private.audit_leave_submitted();

create trigger audit_change after insert or update or delete on public.holidays
  for each row execute function private.audit_reference_change('holiday');
create trigger notify_holiday_added after insert on public.holidays
  for each row execute function private.notify_holiday_added();
create trigger audit_change after insert or update or delete on public.leave_types
  for each row execute function private.audit_reference_change('leave_type');
create trigger audit_change after insert or update or delete on public.departments
  for each row execute function private.audit_reference_change('department');
create trigger audit_change after insert or update or delete on public.leave_balances
  for each row execute function private.audit_reference_change('leave_balance');
create trigger audit_change after update on public.app_settings
  for each row execute function private.audit_reference_change('settings');

create trigger handle_document_change after insert or update or delete on public.payslips
  for each row execute function private.handle_payroll_document_change();
create trigger handle_document_change after insert or update or delete on public.ytd_reports
  for each row execute function private.handle_payroll_document_change();
create trigger handle_document_change after insert or update or delete on public.pf_ytd_reports
  for each row execute function private.handle_payroll_document_change();
