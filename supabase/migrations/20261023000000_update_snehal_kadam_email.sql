-- =============================================================================
-- Migration: Update Snehal Lalit Kadam official email to secondmedic.com
-- Official Email: snehal.kadam@secondmedic.com
-- Personal Email: snehal.kadam@gmail.com
-- =============================================================================

do $$
declare
  v_emp_id bigint;
  v_emp_code text;
begin
  -- 1. Locate employee record
  select id, emp_code into v_emp_id, v_emp_code
  from public.employees
  where official_email in ('snehal.kadam@secondmedic.com', 'snehal.kadam@gmail.com')
     or personal_email in ('snehal.kadam@secondmedic.com', 'snehal.kadam@gmail.com')
     or full_name ilike '%Snehal%Kadam%'
  order by id desc
  limit 1;

  if v_emp_id is not null then
    -- 2. Update employee official and personal emails
    update public.employees set
      official_email = 'snehal.kadam@secondmedic.com',
      personal_email = 'snehal.kadam@gmail.com'
    where id = v_emp_id;

    -- 3. Update auth.users if an account already exists under the gmail address
    update auth.users set
      email = 'snehal.kadam@secondmedic.com',
      raw_user_meta_data = coalesce(raw_user_meta_data, '{}'::jsonb) || jsonb_build_object('email', 'snehal.kadam@secondmedic.com'),
      email_change = null,
      email_change_token_current = null,
      email_change_token_new = null,
      updated_at = now()
    where email = 'snehal.kadam@gmail.com';

    raise notice 'Successfully updated Snehal Lalit Kadam (ID: %, Emp Code: %) official email to snehal.kadam@secondmedic.com.', v_emp_id, v_emp_code;
  else
    raise notice 'Snehal Lalit Kadam employee record not found to update.';
  end if;
end $$;
