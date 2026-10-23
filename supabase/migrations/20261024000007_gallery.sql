-- -----------------------------------------------------------------------------
-- 20261024000007_gallery.sql
-- Feature 11: Branch Photo Gallery
-- -----------------------------------------------------------------------------

-- 1. Create gallery_albums table
create table if not exists public.gallery_albums (
  id bigserial primary key,
  branch_id bigint references public.branches(id) on delete cascade,
  title text not null,
  event_type text not null check (event_type in ('FESTIVAL', 'BIRTHDAY', 'OTHER')),
  event_date date not null default current_date,
  description text,
  created_by bigint references public.employees(id),
  created_at timestamptz not null default now()
);

-- Enable RLS
alter table public.gallery_albums enable row level security;

-- Policies for gallery_albums
drop policy if exists select_gallery_albums on public.gallery_albums;
create policy select_gallery_albums on public.gallery_albums
  for select to authenticated
  using (true);

drop policy if exists hr_or_branch_admin_manages_albums on public.gallery_albums;
create policy hr_or_branch_admin_manages_albums on public.gallery_albums
  for all to authenticated
  using (
    public.has_role('HR')
    or exists (
      select 1 from public.branches b
      where b.id = gallery_albums.branch_id
        and public.current_employee_id() = any(b.admin_employee_ids)
    )
  )
  with check (
    public.has_role('HR')
    or exists (
      select 1 from public.branches b
      where b.id = gallery_albums.branch_id
        and public.current_employee_id() = any(b.admin_employee_ids)
    )
  );

-- 2. Create gallery_photos table
create table if not exists public.gallery_photos (
  id bigserial primary key,
  album_id bigint not null references public.gallery_albums(id) on delete cascade,
  file_path text not null,
  caption text,
  uploaded_by bigint references public.employees(id),
  uploaded_at timestamptz not null default now()
);

-- Enable RLS
alter table public.gallery_photos enable row level security;

-- Policies for gallery_photos
drop policy if exists select_gallery_photos on public.gallery_photos;
create policy select_gallery_photos on public.gallery_photos
  for select to authenticated
  using (true);

drop policy if exists insert_gallery_photos on public.gallery_photos;
create policy insert_gallery_photos on public.gallery_photos
  for insert to authenticated
  with check (
    public.has_role('HR')
    or exists (
      select 1 from public.gallery_albums a
      join public.branches b on b.id = a.branch_id
      where a.id = album_id
        and public.current_employee_id() = any(b.admin_employee_ids)
    )
  );

drop policy if exists delete_gallery_photos on public.gallery_photos;
create policy delete_gallery_photos on public.gallery_photos
  for delete to authenticated
  using (
    public.has_role('HR')
    or uploaded_by = public.current_employee_id()
  );

grant select, insert, update, delete on public.gallery_albums to authenticated;
grant select, insert, update, delete on public.gallery_photos to authenticated;
