-- -----------------------------------------------------------------------------
-- 20261024000008_single_level_leave_approval.sql
-- Feature 4: Single-Level Leave Approval by Reporting Authority & Email Triggers
-- -----------------------------------------------------------------------------

create or replace function public.enforce_leave_approval()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  me bigint := public.current_employee_id();
  emp_name text;
  emp_email text;
  mgr_email text;
  mgr_id bigint;
  hr_email text := 'hr@secondmedic.com';
begin
  if auth.uid() is null then
    return new; -- service role / backend jobs
  end if;

  select full_name, official_email, manager_id
  into emp_name, emp_email, mgr_id
  from public.employees
  where id = coalesce(new.employee_id, old.employee_id);

  if mgr_id is not null then
    select official_email into mgr_email from public.employees where id = mgr_id;
  end if;

  if TG_OP = 'INSERT' then
    -- When leave is applied: notify reporting manager (or HR if none)
    if mgr_email is not null then
      perform public.queue_email(
        'leave_applied',
        mgr_email,
        null,
        'Leave Application: ' || coalesce(emp_name, 'Employee'),
        jsonb_build_object(
          'employeeName', emp_name,
          'fromDate', new.from_date,
          'toDate', new.to_date,
          'days', new.days,
          'reason', new.reason,
          'actionUrl', '/team-approvals'
        ),
        'leave_apply:' || new.id::text
      );
    else
      -- Fallback to HR if no manager
      perform public.queue_email(
        'leave_applied',
        hr_email,
        null,
        'Leave Application: ' || coalesce(emp_name, 'Employee'),
        jsonb_build_object(
          'employeeName', emp_name,
          'fromDate', new.from_date,
          'toDate', new.to_date,
          'days', new.days,
          'reason', new.reason,
          'actionUrl', '/leave-approvals'
        ),
        'leave_apply:' || new.id::text
      );
    end if;

    return new;
  end if;

  -- TG_OP = 'UPDATE'
  if new.status is distinct from old.status
     or new.current_level is distinct from old.current_level
     or new.current_approver_id is distinct from old.current_approver_id then

    -- Employee withdrawing or cancelling
    if old.employee_id = me then
      if new.status in ('WITHDRAWN', 'CANCELLED') and old.status = 'PENDING' then
        -- Notify manager and HR
        if mgr_email is not null then
          perform public.queue_email(
            'leave_withdrawn',
            mgr_email,
            hr_email,
            'Leave ' || new.status || ': ' || coalesce(emp_name, 'Employee'),
            jsonb_build_object(
              'employeeName', emp_name,
              'fromDate', new.from_date,
              'toDate', new.to_date,
              'status', new.status
            ),
            'leave_withdraw:' || new.id::text || ':' || new.status
          );
        end if;
        return new;
      end if;
      raise exception 'You cannot approve or reject your own leave request';
    end if;

    if old.status <> 'PENDING' then
      raise exception 'This leave request is already %', old.status;
    end if;

    -- Only reporting authority or HR can approve/reject
    if not (old.current_approver_id = me or public.is_in_reporting_line(old.employee_id) or public.has_role('HR')) then
      raise exception 'Only the reporting authority (or HR) can action this request';
    end if;

    -- Single-level approval: no second approval. Set current_level = 1, max_levels = 1.
    new.current_level := 1;
    new.max_levels := 1;

    -- If approved or rejected, notify employee with HR in CC
    if new.status in ('APPROVED', 'REJECTED') then
      if emp_email is not null then
        perform public.queue_email(
          'leave_decided',
          emp_email,
          hr_email,
          'Leave Request ' || new.status,
          jsonb_build_object(
            'employeeName', emp_name,
            'status', new.status,
            'fromDate', new.from_date,
            'toDate', new.to_date,
            'days', new.days,
            'rejectionReason', new.rejection_reason
          ),
          'leave_decision:' || new.id::text || ':' || new.status
        );
      end if;
    end if;

    return new;
  end if;

  return new;
end $$;

drop trigger if exists leave_requests_enforce_approval on public.leave_requests;
create trigger leave_requests_enforce_approval
  before update on public.leave_requests
  for each row execute function public.enforce_leave_approval();

drop trigger if exists leave_requests_enforce_insert on public.leave_requests;
create trigger leave_requests_enforce_insert
  after insert on public.leave_requests
  for each row execute function public.enforce_leave_approval();
