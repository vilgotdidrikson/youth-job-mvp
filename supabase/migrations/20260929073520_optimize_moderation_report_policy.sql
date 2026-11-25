drop policy if exists "reporters read own reports" on public.moderation_reports;
drop policy if exists "admins read moderation reports" on public.moderation_reports;

create policy "reporters or admins read moderation reports"
  on public.moderation_reports for select
  to authenticated
  using (
    (select auth.uid()) = reporter_user_id
    or (select public.is_admin_account())
  );
