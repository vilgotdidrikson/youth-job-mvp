alter table public.youth_profiles
  add column if not exists additional_addresses jsonb not null default '[]'::jsonb;
