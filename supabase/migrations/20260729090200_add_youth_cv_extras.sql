alter table public.youth_profiles
  add column if not exists certificates text,
  add column if not exists extracurriculars text,
  add column if not exists profile_image_url text;
