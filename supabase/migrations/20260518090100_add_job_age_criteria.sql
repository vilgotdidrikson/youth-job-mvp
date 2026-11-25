-- Add age criteria columns to jobs so companies can specify min/max age for applicants.
alter table public.jobs
  add column if not exists min_age integer,
  add column if not exists max_age integer;
