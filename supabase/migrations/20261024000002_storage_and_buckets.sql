-- -----------------------------------------------------------------------------
-- 20261024000002_storage_and_buckets.sql
-- F2. Supabase Storage buckets & RLS policies
-- -----------------------------------------------------------------------------

-- 1. Create storage buckets
insert into storage.buckets (id, name, public, file_size_limit)
values
  ('employee-documents', 'employee-documents', false, 10485760),
  ('leave-attachments', 'leave-attachments', false, 10485760),
  ('avatars', 'avatars', false, 10485760),
  ('gallery', 'gallery', false, 10485760)
on conflict (id) do update
set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit;

-- 2. Policies for employee-documents (HR only)
drop policy if exists hr_reads_employee_documents on storage.objects;
create policy hr_reads_employee_documents on storage.objects
  for select to authenticated
  using (
    bucket_id = 'employee-documents'
    and public.has_role('HR')
  );

drop policy if exists hr_manages_employee_documents on storage.objects;
create policy hr_manages_employee_documents on storage.objects
  for all to authenticated
  using (
    bucket_id = 'employee-documents'
    and public.has_role('HR')
  )
  with check (
    bucket_id = 'employee-documents'
    and public.has_role('HR')
  );

-- 3. Policies for leave-attachments
-- Employee, reporting authority / approver, HR can read
drop policy if exists read_leave_attachments on storage.objects;
create policy read_leave_attachments on storage.objects
  for select to authenticated
  using (
    bucket_id = 'leave-attachments'
    and (
      public.has_role('HR')
      or (
        split_part(name, '/', 1) ~ '^[0-9]+$'
        and (
          split_part(name, '/', 1)::bigint = public.current_employee_id()
          or public.is_in_reporting_line(split_part(name, '/', 1)::bigint)
        )
      )
    )
  );

-- Employee can insert their own attachments
drop policy if exists insert_leave_attachments on storage.objects;
create policy insert_leave_attachments on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'leave-attachments'
    and (
      public.has_role('HR')
      or (
        split_part(name, '/', 1) ~ '^[0-9]+$'
        and split_part(name, '/', 1)::bigint = public.current_employee_id()
      )
    )
  );

-- 4. Policies for avatars
-- Any authenticated user can read
drop policy if exists read_avatars on storage.objects;
create policy read_avatars on storage.objects
  for select to authenticated
  using (bucket_id = 'avatars');

-- Owner or HR can write/delete
drop policy if exists manage_own_avatar on storage.objects;
create policy manage_own_avatar on storage.objects
  for all to authenticated
  using (
    bucket_id = 'avatars'
    and (
      public.has_role('HR')
      or (
        (split_part(name, '/', 1) ~ '^[0-9]+$' and split_part(name, '/', 1)::bigint = public.current_employee_id())
        or (split_part(name, '/', 2) ~ '^[0-9]+$' and split_part(name, '/', 2)::bigint = public.current_employee_id())
      )
    )
  )
  with check (
    bucket_id = 'avatars'
    and (
      public.has_role('HR')
      or (
        (split_part(name, '/', 1) ~ '^[0-9]+$' and split_part(name, '/', 1)::bigint = public.current_employee_id())
        or (split_part(name, '/', 2) ~ '^[0-9]+$' and split_part(name, '/', 2)::bigint = public.current_employee_id())
      )
    )
  );

-- 5. Policies for gallery
-- Any authenticated user can read
drop policy if exists read_gallery_photos on storage.objects;
create policy read_gallery_photos on storage.objects
  for select to authenticated
  using (bucket_id = 'gallery');

-- HR or branch admins can insert/update/delete
drop policy if exists manage_gallery_photos on storage.objects;
create policy manage_gallery_photos on storage.objects
  for all to authenticated
  using (
    bucket_id = 'gallery'
    and (
      public.has_role('HR')
      or exists (
        select 1 from public.branches b
        where public.current_employee_id() = any(b.admin_employee_ids)
      )
    )
  )
  with check (
    bucket_id = 'gallery'
    and (
      public.has_role('HR')
      or exists (
        select 1 from public.branches b
        where public.current_employee_id() = any(b.admin_employee_ids)
      )
    )
  );
