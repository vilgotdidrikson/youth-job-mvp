-- An uploaded CV is a valid alternative to a CV written in Employo.
alter table public.youth_profiles
  add column if not exists cv_uploaded boolean not null default false;

drop policy if exists "swipes youth with completed cv" on public.swipe_actions;

create policy "swipes youth with completed cv"
  on public.swipe_actions
  for all
  using (
    auth.uid() = youth_user_id
    and exists (
      select 1
      from public.youth_profiles youth_profile
      where youth_profile.user_id = auth.uid()
        and (
          coalesce(trim(youth_profile.cv_text), '') <> ''
          or youth_profile.cv_uploaded = true
          or exists (
            select 1
            from jsonb_array_elements(coalesce(youth_profile.documents, '[]'::jsonb)) document
            where document->>'type' = 'cv'
          )
        )
    )
  )
  with check (
    auth.uid() = youth_user_id
    and exists (
      select 1
      from public.youth_profiles youth_profile
      where youth_profile.user_id = auth.uid()
        and (
          coalesce(trim(youth_profile.cv_text), '') <> ''
          or youth_profile.cv_uploaded = true
          or exists (
            select 1
            from jsonb_array_elements(coalesce(youth_profile.documents, '[]'::jsonb)) document
            where document->>'type' = 'cv'
          )
        )
    )
  );
