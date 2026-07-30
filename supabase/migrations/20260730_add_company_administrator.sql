alter table public.company_profiles
  add column if not exists administrator text not null default '';

notify pgrst, 'reload schema';
