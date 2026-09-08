-- Keep this migration intentionally limited to youth_profiles. This avoids
-- holding a schema lock on that table while later migrations acquire locks on
-- jobs for foreign keys, which can deadlock with a live API request.

alter table public.youth_profiles
  add column if not exists short_onboarding_completed boolean not null default false;

-- Existing finished profiles already supplied the short account information.
-- This keeps legacy CV holders out of the new onboarding without changing their CV data.
update public.youth_profiles
set short_onboarding_completed = true
where short_onboarding_completed = false
  and (
    onboarding_completed = true
    or coalesce(trim(cv_text), '') <> ''
    or cv_generated = true
    or cv_uploaded = true
    or exists (
      select 1 from jsonb_array_elements(coalesce(documents, '[]'::jsonb)) document
      where document->>'type' in ('cv', 'generated_cv')
    )
  );
