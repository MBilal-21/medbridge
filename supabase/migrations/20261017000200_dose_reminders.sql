-- Email reminders at each dose time.
--
-- pg_cron calls the app's /api/reminders every 5 minutes; the app emails each
-- patient the medicines due now. dose_reminders records each (patient, time)
-- sent, so a dose is never emailed twice.

create extension if not exists pg_cron;
create extension if not exists pg_net with schema extensions;

-- Patients can turn reminders off.
alter table public.profiles add column dose_reminders boolean not null default true;

-- Server-only settings (app URL, cron secret). RLS on with no policies, so only
-- the service role and the database itself can read it. Values are set outside git.
create table public.app_settings (
  key text primary key,
  value text not null
);
alter table public.app_settings enable row level security;
revoke all on public.app_settings from anon, authenticated;

create table public.dose_reminders (
  id uuid primary key default gen_random_uuid(),
  patient_id uuid not null references public.profiles (id) on delete cascade,
  due_at timestamptz not null,
  medication_ids uuid[] not null,
  sent_at timestamptz,
  error text,
  created_at timestamptz not null default now(),
  unique (patient_id, due_at)
);
alter table public.dose_reminders enable row level security;
create policy "Patients read own reminders" on public.dose_reminders
  for select to authenticated using (patient_id = (select auth.uid()));

-- Does nothing until app_url and cron_secret are set in app_settings.
create or replace function private.send_dose_reminders()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  base text := (select value from public.app_settings where key = 'app_url');
  secret text := (select value from public.app_settings where key = 'cron_secret');
begin
  if base is null or secret is null then
    return;
  end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/api/reminders',
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
end;
$$;
revoke execute on function private.send_dose_reminders() from public, anon, authenticated;

select cron.schedule('dose-reminders', '*/5 * * * *', 'select private.send_dose_reminders()');
