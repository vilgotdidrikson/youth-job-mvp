-- N05: structured practical details on a listing (start, hours, working times, period, last application day).
-- Shape and rules live in lib/job-practical.ts; the database only guarantees a small JSON object.
-- Existing listings get '{}', which shows nothing. No RLS change: companies already write their own jobs.
alter table public.jobs add column if not exists practical_details jsonb not null default '{}'::jsonb;
alter table public.jobs drop constraint if exists jobs_practical_details_object;
alter table public.jobs add constraint jobs_practical_details_object
  check (jsonb_typeof(practical_details) = 'object' and pg_column_size(practical_details) <= 2048);
