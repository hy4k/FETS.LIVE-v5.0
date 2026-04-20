-- Paragon CELPIP schedule snapshots (counts only), stored per FETS branch_location (cochin/calicut)
-- - apply_paragon_snapshot(branch, slots) applies updates atomically for that branch only

drop table if exists public.paragon_celpip_bookings cascade;

create table public.paragon_celpip_bookings (
  branch_location text not null check (branch_location in ('cochin', 'calicut')),
  slot_key text not null,
  exam_date date not null,
  start_time text not null,
  test_type text not null default 'G',
  booked_count integer not null default 0,
  capacity integer not null default 0,
  source text not null default 'paragon-test-centre-portal',
  updated_at timestamptz not null default now(),
  primary key (branch_location, slot_key)
);

create index paragon_celpip_bookings_branch_date_idx
  on public.paragon_celpip_bookings (branch_location, exam_date);

create table if not exists public.paragon_schedule_sync_runs (
  id bigserial primary key,
  branch_location text,
  ok boolean not null,
  message text,
  slot_count integer not null default 0,
  created_at timestamptz not null default now()
);

alter table public.paragon_celpip_bookings enable row level security;
alter table public.paragon_schedule_sync_runs enable row level security;

drop policy if exists "paragon_celpip_bookings_select_authenticated" on public.paragon_celpip_bookings;
create policy "paragon_celpip_bookings_select_authenticated"
on public.paragon_celpip_bookings
for select
to authenticated
using (true);

drop policy if exists "paragon_sync_runs_select_authenticated" on public.paragon_schedule_sync_runs;
create policy "paragon_sync_runs_select_authenticated"
on public.paragon_schedule_sync_runs
for select
to authenticated
using (true);

drop function if exists public.apply_paragon_snapshot(jsonb);
drop function if exists public.apply_paragon_snapshot(text, jsonb);

create or replace function public.apply_paragon_snapshot(p_branch_location text, p_slots jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_branch text;
begin
  v_branch := lower(trim(p_branch_location));
  if v_branch not in ('cochin', 'calicut') then
    raise exception 'invalid branch_location: %', p_branch_location;
  end if;

  if p_slots is null or jsonb_typeof(p_slots) <> 'array' then
    raise exception 'p_slots must be a jsonb array';
  end if;

  -- Safety: never interpret an empty payload as "delete everything for this branch"
  if not exists (
    select 1
    from jsonb_array_elements(p_slots) elem(value)
    where coalesce(nullif(value->>'slot_key', ''), null) is not null
  ) then
    raise exception 'p_slots must contain at least one non-empty slot_key';
  end if;

  delete from public.paragon_celpip_bookings b
  where b.branch_location = v_branch
    and not exists (
      select 1
      from jsonb_array_elements(p_slots) elem(value)
      where (value->>'slot_key') = b.slot_key
    );

  insert into public.paragon_celpip_bookings as t (
    branch_location,
    slot_key,
    exam_date,
    start_time,
    test_type,
    booked_count,
    capacity,
    source,
    updated_at
  )
  select
    v_branch,
    value->>'slot_key',
    (value->>'exam_date')::date,
    value->>'start_time',
    coalesce(value->>'test_type', 'G'),
    coalesce((value->>'booked_count')::int, 0),
    coalesce((value->>'capacity')::int, 0),
    coalesce(value->>'source', 'paragon-test-centre-portal'),
    now()
  from jsonb_array_elements(p_slots) elem(value)
  on conflict (branch_location, slot_key) do update
    set exam_date = excluded.exam_date,
        start_time = excluded.start_time,
        test_type = excluded.test_type,
        booked_count = excluded.booked_count,
        capacity = excluded.capacity,
        source = excluded.source,
        updated_at = excluded.updated_at;
end;
$$;

revoke all on function public.apply_paragon_snapshot(text, jsonb) from public;
revoke execute on function public.apply_paragon_snapshot(text, jsonb) from anon, authenticated;
grant execute on function public.apply_paragon_snapshot(text, jsonb) to service_role;

-- NOTE: Before this cron job can work, you must create Vault secrets:
--   project_url  -> https://<project-ref>.supabase.co
--   anon_key     -> <anon key> (or a dedicated restricted key)
--   paragon_sync_secret -> shared secret matching Edge Function secret PARAGON_SYNC_SECRET
--
-- Example (run in SQL editor):
--   select vault.create_secret('https://<project-ref>.supabase.co', 'project_url');
--   select vault.create_secret('<anon_key>', 'anon_key');
--   select vault.create_secret('<random_secret>', 'paragon_sync_secret');
--   select vault.create_secret('<same_random_secret>', 'PARAGON_SYNC_SECRET'); -- function secret name

do $$
declare
  v_jobid bigint;
begin
  for v_jobid in
    select jobid from cron.job where jobname in (
      'paragon-schedule-sync-hourly',
      'paragon-schedule-sync-hourly-cochin',
      'paragon-schedule-sync-hourly-calicut'
    )
  loop
    begin
      perform cron.unschedule(v_jobid);
    exception when others then
      null;
    end;
  end loop;
exception when others then
  null;
end;
$$;

select cron.schedule(
  'paragon-schedule-sync-hourly-cochin',
  '0 * * * *',
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/paragon-schedule-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-paragon-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'paragon_sync_secret')
      ),
      body := jsonb_build_object(
        'mode', 'sync',
        'location', 'cochin',
        'startMonth', '2026-04',
        'endMonth', '2026-06'
      )
    ) as request_id;
  $$
);

select cron.schedule(
  'paragon-schedule-sync-hourly-calicut',
  '5 * * * *',
  $$
  select
    net.http_post(
      url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/paragon-schedule-sync',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
        'x-paragon-sync-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'paragon_sync_secret')
      ),
      body := jsonb_build_object(
        'mode', 'sync',
        'location', 'calicut',
        'startMonth', '2026-04',
        'endMonth', '2026-06'
      )
    ) as request_id;
  $$
);
