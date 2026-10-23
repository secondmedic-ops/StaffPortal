-- -----------------------------------------------------------------------------
-- 20261024000009_daily_cron_schedule.sql
-- Schedule daily-jobs at 08:00 IST (02:30 UTC) and send-email every 5 minutes
-- -----------------------------------------------------------------------------

create extension if not exists pg_net;
create extension if not exists pg_cron;

do $$
begin
  -- 1. Daily jobs at 08:00 IST (02:30 UTC)
  if exists (select 1 from cron.job where jobname = 'secondmedic-daily-jobs') then
    perform cron.unschedule('secondmedic-daily-jobs');
  end if;

  perform cron.schedule(
    'secondmedic-daily-jobs',
    '30 2 * * *',
    'select net.http_post(url := ''https://mxmweaouqgfvxzfbxwby.supabase.co/functions/v1/daily-jobs'', headers := ''{"Content-Type": "application/json"}''::jsonb);'
  );

  -- 2. Flush email outbox every 5 minutes
  if exists (select 1 from cron.job where jobname = 'secondmedic-flush-email-outbox') then
    perform cron.unschedule('secondmedic-flush-email-outbox');
  end if;

  perform cron.schedule(
    'secondmedic-flush-email-outbox',
    '*/5 * * * *',
    'select net.http_post(url := ''https://mxmweaouqgfvxzfbxwby.supabase.co/functions/v1/send-email'', headers := ''{"Content-Type": "application/json"}''::jsonb);'
  );
exception when others then
  -- If cron permissions or extension is restricted in certain environments, log warning gracefully
  raise notice 'Cron scheduling notice: %', SQLERRM;
end $$;
