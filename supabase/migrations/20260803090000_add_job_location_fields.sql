-- Jobs may be placed on the map by a full workplace address or by coordinates
-- supplied by an integration. This is safe to run in the Supabase SQL Editor
-- if the earlier migration has not been applied yet.
alter table public.jobs
  add column if not exists address text not null default '',
  add column if not exists postal_code text not null default '',
  add column if not exists longitude double precision,
  add column if not exists latitude double precision;

alter table public.jobs
  drop constraint if exists jobs_valid_coordinates;

alter table public.jobs
  add constraint jobs_valid_coordinates check (
    (longitude is null and latitude is null)
    or (longitude between -180 and 180 and latitude between -90 and 90)
  );
