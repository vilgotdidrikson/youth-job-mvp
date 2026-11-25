-- Public RPCs remain invokers; authenticated ownership checks and privileged reads live in private functions.
create function private.get_application_disclosure(p_job_id uuid,p_youth_user_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not (auth.uid()=p_youth_user_id or private.disclosure_company_access(p_job_id,p_youth_user_id,auth.uid())) then raise exception 'Application access required' using errcode='42501'; end if;
 return private.shared_application_packet(p_job_id,p_youth_user_id);
end $$;
revoke all on function private.get_application_disclosure(uuid,uuid) from public,anon;
grant execute on function private.get_application_disclosure(uuid,uuid) to authenticated;
create or replace function public.get_application_disclosure(p_job_id uuid,p_youth_user_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_application_disclosure(p_job_id,p_youth_user_id); $$;

create function private.get_my_application_disclosure_preview(p_job_id uuid,p_selection text[] default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare existing private.application_disclosures; current_input jsonb; j public.jobs;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='youth') then raise exception 'Youth authentication required' using errcode='42501'; end if;
 select * into j from public.jobs where id=p_job_id;
 select * into existing from private.application_disclosures where job_id=p_job_id and youth_user_id=auth.uid();
 if j.id is null or public.users_are_blocked(auth.uid(),j.company_user_id) or (existing.job_id is null and (j.status<>'active' or not j.is_active or j.publication_status<>'published')) then raise exception 'Application unavailable' using errcode='42501'; end if;
 current_input:=private.build_application_disclosure(p_job_id,auth.uid(),coalesce(p_selection,'{}'));
 if p_selection is null and existing.job_id is not null then
  return jsonb_build_object('packet',private.shared_application_packet(p_job_id,auth.uid()),'matching_input',existing.matching_input-'full_name'-'address'-'postal_code'-'email'-'phone','options',current_input->'options','selected_keys',existing.selected_keys,'source_token',existing.source_token,'is_saved',true);
 end if;
 return (current_input-'matching_input')||jsonb_build_object('matching_input',(current_input->'matching_input')-'full_name'-'address'-'postal_code'-'email'-'phone','selected_keys',coalesce(p_selection,'{}'),'is_saved',false);
end $$;
revoke all on function private.get_my_application_disclosure_preview(uuid,text[]) from public,anon;
grant execute on function private.get_my_application_disclosure_preview(uuid,text[]) to authenticated;
create or replace function public.get_my_application_disclosure_preview(p_job_id uuid,p_selection text[] default null) returns jsonb language sql security invoker set search_path='' as $$ select private.get_my_application_disclosure_preview(p_job_id,p_selection); $$;

create function private.save_my_application_disclosure(p_job_id uuid,p_selection text[],p_source_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_input jsonb;
begin
 perform public.get_my_application_disclosure_preview(p_job_id,p_selection);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_job_id::text,0));
 perform 1 from public.youth_profiles where user_id=auth.uid() for share;
 current_input:=private.build_application_disclosure(p_job_id,auth.uid(),p_selection);
 if p_source_token is distinct from current_input->>'source_token' then raise exception 'Profilen har ändrats. Läs förhandsvisningen igen.' using errcode='40001'; end if;
 insert into private.application_disclosures(job_id,youth_user_id,selected_keys,source_token,packet,matching_input)
 values(p_job_id,auth.uid(),p_selection,p_source_token,current_input->'packet',current_input->'matching_input')
 on conflict(job_id,youth_user_id) do update set revision=application_disclosures.revision+1,selected_keys=excluded.selected_keys,source_token=excluded.source_token,packet=excluded.packet,matching_input=excluded.matching_input,updated_at=now();
 perform private.enqueue_application_analysis(p_job_id,auth.uid());
 return private.shared_application_packet(p_job_id,auth.uid());
end $$;
revoke all on function private.save_my_application_disclosure(uuid,text[],text) from public,anon;
grant execute on function private.save_my_application_disclosure(uuid,text[],text) to authenticated;
create or replace function public.save_my_application_disclosure(p_job_id uuid,p_selection text[],p_source_token text) returns jsonb language sql security invoker set search_path='' as $$ select private.save_my_application_disclosure(p_job_id,p_selection,p_source_token); $$;

create function private.get_job_requirement_insight(p_job_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 if auth.uid() is null or not exists(select 1 from public.profiles where id=auth.uid() and role='youth') then raise exception 'Youth authentication required' using errcode='42501'; end if;
 select jsonb_build_object('job_id',j.id,'title',j.title,'requirements',j.requirements,'role_summary',coalesce(m.role_summary,''),
  'criteria',coalesce((select jsonb_agg(jsonb_build_object('label',c->>'label','category',c->>'category','required',coalesce(c->'required'='true'::jsonb,false))) from jsonb_array_elements(m.weighted_criteria) c),'[]')) into result
 from public.jobs j left join public.job_match_profiles m on m.job_id=j.id and m.status='approved'
 where j.id=p_job_id and j.publication_status='published' and j.job_kind='employment' and not public.users_are_blocked(auth.uid(),j.company_user_id);
 if result is null then raise exception 'Job unavailable' using errcode='42501'; end if;
 return result;
end $$;
revoke all on function private.get_job_requirement_insight(uuid) from public,anon;
grant execute on function private.get_job_requirement_insight(uuid) to authenticated;
create or replace function public.get_job_requirement_insight(p_job_id uuid) returns jsonb language sql security invoker set search_path='' as $$ select private.get_job_requirement_insight(p_job_id); $$;
