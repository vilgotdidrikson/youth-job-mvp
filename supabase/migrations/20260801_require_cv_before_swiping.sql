-- A completed CV is required before a youth account can record a job swipe.
-- This mirrors the UI gate and protects the rule from direct client requests.
drop policy if exists "swipes youth own" on public.swipe_actions;

create policy "swipes youth with completed cv"
  on public.swipe_actions
  for all
  using (
    auth.uid() = youth_user_id
    and exists (
      select 1
      from public.youth_profiles youth_profile
      where youth_profile.user_id = auth.uid()
        and coalesce(trim(youth_profile.cv_text), '') <> ''
    )
  )
  with check (
    auth.uid() = youth_user_id
    and exists (
      select 1
      from public.youth_profiles youth_profile
      where youth_profile.user_id = auth.uid()
        and coalesce(trim(youth_profile.cv_text), '') <> ''
    )
  );
