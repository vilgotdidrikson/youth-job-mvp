-- L13: explicit re-sharing of corrected application material and a neutral receipt
-- for its recipient, atomically. Existing save/build/access functions are reused,
-- never replaced. No tables, columns, policies, buckets or existing grants change.
create function private.get_my_application_correction_preview(p_job_id uuid,p_selection text[] default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare preview jsonb; base_revision integer;
begin
 if auth.uid() is null then raise exception 'Youth authentication required' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_job_id::text,0));
 select d.revision into base_revision from private.application_disclosures d
 where d.job_id=p_job_id and d.youth_user_id=auth.uid() for share;
 preview:=private.get_my_application_disclosure_preview(p_job_id,p_selection);
 return preview||jsonb_build_object('base_revision',base_revision);
end $$;
revoke all on function private.get_my_application_correction_preview(uuid,text[]) from public,anon;
grant execute on function private.get_my_application_correction_preview(uuid,text[]) to authenticated;
create function public.get_my_application_correction_preview(p_job_id uuid,p_selection text[] default null)
returns jsonb language sql security invoker set search_path='' as $$
 select private.get_my_application_correction_preview(p_job_id,p_selection);
$$;
revoke all on function public.get_my_application_correction_preview(uuid,text[]) from public,anon;
grant execute on function public.get_my_application_correction_preview(uuid,text[]) to authenticated;

create function private.correct_my_application_disclosure(p_job_id uuid,p_selection text[],p_source_token text,p_expected_revision integer,p_expected_youth_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); existing private.application_disclosures; j public.jobs; result jsonb;
begin
 if caller is null or p_expected_youth_id is distinct from caller or not exists(select 1 from public.profiles where id=caller and role='youth') then
  raise exception 'Youth authentication required' using errcode='42501';
 end if;
 if p_job_id is null or p_expected_revision is null or p_expected_revision<1 or p_selection is null or p_source_token is null then
  raise exception 'Invalid correction' using errcode='22023';
 end if;
 -- Same lock order as ordinary sharing/withdrawal; serialize two corrections.
 perform pg_advisory_xact_lock(hashtextextended(caller::text||':'||p_job_id::text,0));
 perform 1 from public.youth_profiles where user_id=caller for share;
 select * into j from public.jobs where id=p_job_id for share;
 if j.id is null or not exists(select 1 from public.swipe_actions s where s.job_id=p_job_id and s.youth_user_id=caller and s.decision='interested')
 or not exists(select 1 from public.application_completions a where a.job_id=p_job_id and a.youth_user_id=caller and a.status='submitted') then
  raise exception 'Submitted application access required' using errcode='42501';
 end if;
 -- Preserve all current preview/source/retention checks, including blocked contact.
 perform private.get_my_application_disclosure_preview(p_job_id,p_selection);
 select * into existing from private.application_disclosures d where d.job_id=p_job_id and d.youth_user_id=caller for update;
 if not found then raise exception 'Application unavailable' using errcode='42501'; end if;
 if existing.revision<p_expected_revision then raise exception 'Read the current application again' using errcode='PT409'; end if;
 -- Desired state already committed: retry does not create another revision,
 -- model job or notification. No previous application revision is restored.
 if existing.source_token=p_source_token and existing.selected_keys=p_selection then
  return private.shared_application_packet(p_job_id,caller);
 end if;
 if existing.revision<>p_expected_revision then raise exception 'Read the current application again' using errcode='PT409'; end if;
 result:=private.save_my_application_disclosure(p_job_id,p_selection,p_source_token);
 -- A failed notification rolls back sharing and analysis enqueue as well.
 -- No CV text, identity, correction text or other applications in the notice.
 insert into public.notifications(user_id,type,title,body,href) values(j.company_user_id,'application_update',
  'Ansökningsunderlag uppdaterat','En sökande har uppdaterat underlaget för en ansökan. Läs den aktuella versionen innan ni bedömer ansökan.',
  '/company?view=kandidater&job='||p_job_id::text);
 return result;
end $$;
revoke all on function private.correct_my_application_disclosure(uuid,text[],text,integer,uuid) from public,anon;
grant execute on function private.correct_my_application_disclosure(uuid,text[],text,integer,uuid) to authenticated;
create function public.correct_my_application_disclosure(p_job_id uuid,p_selection text[],p_source_token text,p_expected_revision integer,p_expected_youth_id uuid)
returns jsonb language sql security invoker set search_path='' as $$
 select private.correct_my_application_disclosure(p_job_id,p_selection,p_source_token,p_expected_revision,p_expected_youth_id);
$$;
revoke all on function public.correct_my_application_disclosure(uuid,text[],text,integer,uuid) from public,anon;
grant execute on function public.correct_my_application_disclosure(uuid,text[],text,integer,uuid) to authenticated;
notify pgrst, 'reload schema';
