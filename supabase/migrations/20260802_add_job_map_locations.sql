-- Store a public workplace location for the jobs map. Coordinates are saved
-- when an employer publishes a job, avoiding a geocoding request on every visit.
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
