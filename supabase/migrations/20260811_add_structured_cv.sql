alter table public.youth_profiles
  add column if not exists cv_structured jsonb;

comment on column public.youth_profiles.cv_structured is
  'Canonical structured CV facts used to regenerate text and PDF without repeating the interview.';