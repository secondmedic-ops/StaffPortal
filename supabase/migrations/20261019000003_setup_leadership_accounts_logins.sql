-- =============================================================================
-- Migration: Setup Leadership & Accounts Logins
-- 1. Rajneesh Dwivedi (CEO / Owner)
-- 2. Durgesh Mishra (Director)
-- 3. Geetanjali Kagra (Accounts Manager)
-- =============================================================================

do $$
declare
  v_rajneesh_auth uuid;
  v_durgesh_auth uuid;
  v_geetanjali_auth uuid;
  v_rajneesh_emp bigint;
  v_durgesh_emp bigint;
  v_geetanjali_emp bigint;
  v_mgmt_dept bigint;
  v_accounts_dept bigint;
begin
  -- 1. Departments
  select id into v_mgmt_dept from public.departments where name ilike '%Management%' limit 1;
  if v_mgmt_dept is null then
    insert into public.departments (name) values ('Management') returning id into v_mgmt_dept;
  end if;

  select id into v_accounts_dept from public.departments where name ilike '%Accounts%' limit 1;
  if v_accounts_dept is null then
    insert into public.departments (name) values ('Accounts & Finance') returning id into v_accounts_dept;
  end if;

  -- 2. Auth Users
  -- Rajneesh Dwivedi
  select id into v_rajneesh_auth from auth.users where email = 'rajneesh.dwivedi@secondmedic.com';
  if v_rajneesh_auth is null then
    v_rajneesh_auth := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_rajneesh_auth,
      'authenticated',
      'authenticated',
      'rajneesh.dwivedi@secondmedic.com',
      crypt('Rd9$kM8#pQ2!vW5x', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Rajneesh Dwivedi', 'email', 'rajneesh.dwivedi@secondmedic.com'),
      now(),
      now()
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_rajneesh_auth::text,
      v_rajneesh_auth,
      jsonb_build_object('sub', v_rajneesh_auth::text, 'email', 'rajneesh.dwivedi@secondmedic.com'),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.users set
      encrypted_password = crypt('Rd9$kM8#pQ2!vW5x', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_rajneesh_auth;
  end if;

  -- Durgesh Mishra
  select id into v_durgesh_auth from auth.users where email = 'durgesh.mishra@secondmedic.com';
  if v_durgesh_auth is null then
    v_durgesh_auth := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_durgesh_auth,
      'authenticated',
      'authenticated',
      'durgesh.mishra@secondmedic.com',
      crypt('Dm7#xL4!zR9$tY2w', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Durgesh Mishra', 'email', 'durgesh.mishra@secondmedic.com'),
      now(),
      now()
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_durgesh_auth::text,
      v_durgesh_auth,
      jsonb_build_object('sub', v_durgesh_auth::text, 'email', 'durgesh.mishra@secondmedic.com'),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.users set
      encrypted_password = crypt('Dm7#xL4!zR9$tY2w', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_durgesh_auth;
  end if;

  -- Geetanjali Kagra
  select id into v_geetanjali_auth from auth.users where email = 'geetanjali.kagra@secondmedic.com';
  if v_geetanjali_auth is null then
    v_geetanjali_auth := gen_random_uuid();
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at
    ) values (
      '00000000-0000-0000-0000-000000000000',
      v_geetanjali_auth,
      'authenticated',
      'authenticated',
      'geetanjali.kagra@secondmedic.com',
      crypt('Gk3!wP8$mN5#qZ7v', gen_salt('bf')),
      now(),
      '{"provider":"email","providers":["email"]}'::jsonb,
      jsonb_build_object('full_name', 'Geetanjali Kagra', 'email', 'geetanjali.kagra@secondmedic.com'),
      now(),
      now()
    );
    insert into auth.identities (
      id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      v_geetanjali_auth::text,
      v_geetanjali_auth,
      jsonb_build_object('sub', v_geetanjali_auth::text, 'email', 'geetanjali.kagra@secondmedic.com'),
      'email',
      now(),
      now(),
      now()
    );
  else
    update auth.users set
      encrypted_password = crypt('Gk3!wP8$mN5#qZ7v', gen_salt('bf')),
      email_confirmed_at = coalesce(email_confirmed_at, now())
    where id = v_geetanjali_auth;
  end if;

  -- 3. Upsert Employees
  -- Rajneesh Dwivedi (CEO / Owner, manager_id NULL)
  select id into v_rajneesh_emp from public.employees where official_email = 'rajneesh.dwivedi@secondmedic.com';
  if v_rajneesh_emp is null then
    insert into public.employees (
      full_name, official_email, emp_code, designation, department_id,
      status, employment_type, date_of_joining, manager_id, auth_user_id
    ) values (
      'Rajneesh Dwivedi',
      'rajneesh.dwivedi@secondmedic.com',
      'SM-004',
      'CEO / Owner',
      v_mgmt_dept,
      'ACTIVE',
      'FULL_TIME',
      '2024-01-01',
      null,
      v_rajneesh_auth
    ) returning id into v_rajneesh_emp;
  else
    update public.employees set
      designation = 'CEO / Owner',
      status = 'ACTIVE',
      manager_id = null,
      department_id = v_mgmt_dept,
      auth_user_id = coalesce(auth_user_id, v_rajneesh_auth)
    where id = v_rajneesh_emp;
  end if;

  -- Durgesh Mishra (Director, reports to Rajneesh)
  select id into v_durgesh_emp from public.employees where official_email = 'durgesh.mishra@secondmedic.com';
  if v_durgesh_emp is null then
    insert into public.employees (
      full_name, official_email, emp_code, designation, department_id,
      status, employment_type, date_of_joining, manager_id, auth_user_id
    ) values (
      'Durgesh Mishra',
      'durgesh.mishra@secondmedic.com',
      'SM-005',
      'Director',
      v_mgmt_dept,
      'ACTIVE',
      'FULL_TIME',
      '2024-01-01',
      v_rajneesh_emp,
      v_durgesh_auth
    ) returning id into v_durgesh_emp;
  else
    update public.employees set
      designation = 'Director',
      status = 'ACTIVE',
      manager_id = v_rajneesh_emp,
      department_id = v_mgmt_dept,
      auth_user_id = coalesce(auth_user_id, v_durgesh_auth)
    where id = v_durgesh_emp;
  end if;

  -- Geetanjali Kagra (Accounts Manager, reports to Rajneesh)
  select id into v_geetanjali_emp from public.employees where official_email = 'geetanjali.kagra@secondmedic.com';
  if v_geetanjali_emp is null then
    insert into public.employees (
      full_name, official_email, emp_code, designation, department_id,
      status, employment_type, date_of_joining, manager_id, auth_user_id
    ) values (
      'Geetanjali Kagra',
      'geetanjali.kagra@secondmedic.com',
      'SM-006',
      'Accounts Manager',
      v_accounts_dept,
      'ACTIVE',
      'FULL_TIME',
      '2024-01-01',
      v_rajneesh_emp,
      v_geetanjali_auth
    ) returning id into v_geetanjali_emp;
  else
    update public.employees set
      designation = 'Accounts Manager',
      status = 'ACTIVE',
      manager_id = v_rajneesh_emp,
      department_id = v_accounts_dept,
      auth_user_id = coalesce(auth_user_id, v_geetanjali_auth)
    where id = v_geetanjali_emp;
  end if;

  -- 4. Set department head for Accounts
  update public.departments
  set head_id = v_geetanjali_emp
  where id = v_accounts_dept;

  -- 5. Roles
  delete from public.employee_roles where employee_id = v_rajneesh_emp;
  insert into public.employee_roles (employee_id, role) values
    (v_rajneesh_emp, 'CEO'::public.app_role),
    (v_rajneesh_emp, 'MANAGER'::public.app_role),
    (v_rajneesh_emp, 'EMPLOYEE'::public.app_role);

  delete from public.employee_roles where employee_id = v_durgesh_emp;
  insert into public.employee_roles (employee_id, role) values
    (v_durgesh_emp, 'DIRECTOR'::public.app_role),
    (v_durgesh_emp, 'MANAGER'::public.app_role),
    (v_durgesh_emp, 'EMPLOYEE'::public.app_role);

  delete from public.employee_roles where employee_id = v_geetanjali_emp;
  insert into public.employee_roles (employee_id, role) values
    (v_geetanjali_emp, 'ACCOUNTS'::public.app_role),
    (v_geetanjali_emp, 'MANAGER'::public.app_role),
    (v_geetanjali_emp, 'EMPLOYEE'::public.app_role);

  -- 6. System Users registration
  insert into public.system_users (employee_id, is_locked)
  values
    (v_rajneesh_emp, false),
    (v_durgesh_emp, false),
    (v_geetanjali_emp, false)
  on conflict (employee_id) do update set is_locked = false;

end $$;
