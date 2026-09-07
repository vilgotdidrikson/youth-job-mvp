-- WOR-13: onboarding must not be able to create a profile without a name.
-- The form and lib/onboarding.ts both validate, this is the database backstop
-- so candidate cards, profiles and chat headers always have something to show.

-- Existing rows: strip padding so whitespace-only names collapse to ''.
update public.youth_profiles
set full_name = btrim(full_name)
where full_name <> btrim(full_name);

-- '' stays allowed: it is the column default for a profile that has not reached
-- the name question yet. A value that is only whitespace is not.
alter table public.youth_profiles
  drop constraint if exists youth_profiles_full_name_trimmed;

alter table public.youth_profiles
  add constraint youth_profiles_full_name_trimmed
  check (full_name = btrim(full_name));

-- A completed onboarding requires a real name. Added NOT VALID so existing
-- nameless rows do not block the migration; every write from here on is checked.
alter table public.youth_profiles
  drop constraint if exists youth_profiles_completed_requires_full_name;

alter table public.youth_profiles
  add constraint youth_profiles_completed_requires_full_name
  check (onboarding_completed is not true or btrim(full_name) <> '')
  not valid;
