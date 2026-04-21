-- Optional structured summary for CELPIP schedule refresh (UI-friendly copy; no PII)
alter table public.paragon_schedule_sync_runs
  add column if not exists sync_details jsonb;
