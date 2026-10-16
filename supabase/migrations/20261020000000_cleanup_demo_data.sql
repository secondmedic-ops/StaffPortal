-- =============================================================================
-- Migration: Clean Up Demo & Test Data from Production Database
-- =============================================================================

do $$
declare
  v_count integer := 0;
begin
  -- 1. Delete associated test records for test employees
  -- (emp_code TEST001, ADM-001, or test probe emails)
  delete from public.salary_revisions
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.attendance_records
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.attendance_regularizations
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.employee_financials
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.employee_profiles
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.employee_roles
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.system_users
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.leave_requests
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.leave_balances
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.it_requests
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  delete from public.lifecycle_tasks
  where employee_id in (
    select id from public.employees 
    where emp_code in ('TEST001', 'ADM-001')
       or full_name ilike '%delete me%'
       or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com')
  );

  -- 2. Delete test employees
  delete from public.employees
  where emp_code in ('TEST001', 'ADM-001')
     or full_name ilike '%delete me%'
     or official_email in ('test_check_signup_probe@secondmedic.com', 'admin@secondmedic.com');

  get diagnostics v_count = row_count;
  raise notice 'Cleaned up % test employee record(s) and associated data.', v_count;

  -- 3. Delete auth user test accounts from auth.users (if accessible)
  delete from auth.users
  where email in (
    'test_check_signup_probe@secondmedic.com',
    'admin@secondmedic.com',
    'admin@secondmedic'
  );

end $$;

