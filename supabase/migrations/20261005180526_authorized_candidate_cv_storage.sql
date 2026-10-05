-- Private predicate is callable from Storage RLS, never through the Data API.
create schema if not exists private;
grant usage on schema private to authenticated;
create function private.can_read_candidate_cv(p_path text)
returns boolean language sql stable security definer set search_path='' as $$
 select auth.uid() is not null and public.is_verified_company() and exists(
   select 1 from public.youth_profiles y
   join public.swipe_actions s on s.youth_user_id=y.user_id and s.decision='interested'
   join public.jobs j on j.id=s.job_id and j.company_user_id=auth.uid()
   where split_part(p_path,'/',1)=y.user_id::text
   and not public.users_are_blocked(auth.uid(),y.user_id)
   and exists(select 1 from jsonb_array_elements(y.documents) d where d->>'type'='cv' and d->>'url'=p_path)
 );
$$;
revoke all on function private.can_read_candidate_cv(text) from public,anon;
grant execute on function private.can_read_candidate_cv(text) to authenticated;
create policy "verified owners read submitted candidate CV" on storage.objects
for select to authenticated using(bucket_id='youth-documents' and private.can_read_candidate_cv(name));
