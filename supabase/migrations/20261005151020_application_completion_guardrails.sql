alter table public.application_completions add column analysis_source_hash text;
alter table public.application_completions add constraint application_analysis_hash_length check(analysis_source_hash is null or length(analysis_source_hash)=64);
-- A withdrawn interest cannot leave employer access to the old answer snapshot.
drop policy "owners read submitted completion" on public.application_completions;
create policy "owners read submitted completion" on public.application_completions for select to authenticated using (
 status='submitted' and public.is_verified_company() and exists(
 select 1 from public.jobs j join public.swipe_actions s on s.job_id=j.id
 where j.id=application_completions.job_id and j.company_user_id=(select auth.uid())
 and s.youth_user_id=application_completions.youth_user_id and s.decision='interested'
 and not public.users_are_blocked((select auth.uid()),s.youth_user_id)
 ));

-- AI-derived excerpts only fill empty slots, under the same transaction lock as manual edits.
create or replace function public.apply_my_application_evidence(p_job_id uuid,p_answers jsonb,p_source_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); a public.application_completions%rowtype; filtered jsonb:='{}'; pair record; complete boolean;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and role='youth') then
   raise exception 'Youth authentication required' using errcode='42501'; end if;
 if p_source_hash is null or length(p_source_hash)<>64 or p_answers is null or jsonb_typeof(p_answers)<>'object' or octet_length(p_answers::text)>16000 then
   raise exception 'Invalid evidence' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
 select * into a from public.application_completions where youth_user_id=caller and job_id=p_job_id for update;
 if not found then raise exception 'Application not found' using errcode='42501'; end if;
 if a.status<>'needs_completion' then return to_jsonb(a); end if;
 for pair in select * from jsonb_each(p_answers) loop
   if coalesce(btrim(a.answers->>pair.key),'')='' then filtered:=filtered||jsonb_build_object(pair.key,pair.value); end if;
 end loop;
 select not exists(select 1 from jsonb_array_elements(a.questions) q where coalesce(btrim((a.answers||filtered)->>(q->>'id')),'')='') into complete;
 perform public.save_my_application_answers(p_job_id,filtered,complete);
 update public.application_completions set analysis_source_hash=p_source_hash where youth_user_id=caller and job_id=p_job_id returning * into a;
 return to_jsonb(a);
end; $$;
revoke all on function public.apply_my_application_evidence(uuid,jsonb,text) from public,anon;
grant execute on function public.apply_my_application_evidence(uuid,jsonb,text) to authenticated;
