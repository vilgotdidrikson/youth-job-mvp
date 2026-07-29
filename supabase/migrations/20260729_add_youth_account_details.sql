alter table public.youth_profiles
  add column if not exists date_of_birth date,
  add column if not exists address text;
