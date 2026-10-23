-- -----------------------------------------------------------------------------
-- 20261024000003_email_outbox.sql
-- F3. Email service outbox table and queuing helpers
-- -----------------------------------------------------------------------------

create table if not exists public.email_outbox (
  id bigserial primary key,
  template text not null,
  "to" text not null,
  "cc" text,
  subject text not null,
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENT', 'FAILED')),
  attempts integer not null default 0,
  last_error text,
  dedupe_key text unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);

-- Enable RLS
alter table public.email_outbox enable row level security;

-- Policies
drop policy if exists hr_reads_email_outbox on public.email_outbox;
create policy hr_reads_email_outbox on public.email_outbox
  for select to authenticated
  using (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'));

drop policy if exists hr_updates_email_outbox on public.email_outbox;
create policy hr_updates_email_outbox on public.email_outbox
  for update to authenticated
  using (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'))
  with check (public.has_role('HR') or public.has_role('SYSTEM_ADMIN'));

drop policy if exists authenticated_inserts_email_outbox on public.email_outbox;
create policy authenticated_inserts_email_outbox on public.email_outbox
  for insert to authenticated
  with check (true);

-- Queuing function
create or replace function public.queue_email(
  p_template text,
  p_to text,
  p_cc text,
  p_subject text,
  p_payload jsonb,
  p_dedupe_key text default null
) returns bigint
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id bigint;
begin
  if p_dedupe_key is not null then
    insert into public.email_outbox (template, "to", "cc", subject, payload, dedupe_key)
    values (p_template, p_to, p_cc, p_subject, coalesce(p_payload, '{}'::jsonb), p_dedupe_key)
    on conflict (dedupe_key) do nothing
    returning id into new_id;
  else
    insert into public.email_outbox (template, "to", "cc", subject, payload)
    values (p_template, p_to, p_cc, p_subject, coalesce(p_payload, '{}'::jsonb))
    returning id into new_id;
  end if;

  return new_id;
end $$;

grant select, insert, update on public.email_outbox to authenticated;
grant execute on function public.queue_email to authenticated;
