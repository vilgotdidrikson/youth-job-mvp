-- Use explicitly saved profile facts for existing unanswered follow-ups.
-- Published manual answers and intentionally skipped questions are never overwritten.
create or replace function private.sync_profile_followups(p_job uuid,p_youth uuid)
returns void language plpgsql security invoker set search_path = '' as $$
declare profile jsonb; start_date text; lang jsonb; begin
 if not private.application_analysis_eligible(p_job,p_youth) then return; end if;
 select recruitment_profile into profile from public.youth_profiles where user_id=p_youth;
 start_date:=profile->'availability'->>'startDate';
 if coalesce(start_date,'')<>'' then
  update public.application_followups set status='answered',answer='Uppgift från profil/CV: Kan börja arbeta: '||start_date,answered_at=now()
   where job_id=p_job and youth_user_id=p_youth and status='pending' and coalesce(btrim(answer),'')='' and criterion_label ~* '(börja|startdatum|tillträde|omgående)' and criterion_label !~* '(helg|kväll|arbetstid|tider|skift)';
 end if;
 for lang in select * from jsonb_array_elements(profile->'qualifications'->'languages') loop
  if lower(lang->>'language') not in ('svenska','engelska','spanska') then continue; end if;
  update public.application_followups set status='answered',answer='Uppgift från profil/CV: Språk: '||(lang->>'language')||', självuppgiven nivå '||(lang->>'level'),answered_at=now()
   where job_id=p_job and youth_user_id=p_youth and status='pending' and coalesce(btrim(answer),'')='' and lower(criterion_label) ~ ('(^|[^[:alpha:]])'||lower(lang->>'language')||'([^[:alpha:]]|$)');
 end loop;
end; $$;
revoke all on function private.sync_profile_followups(uuid,uuid) from public,anon,authenticated;
do $$ declare definition text; routine text; needle text; begin
 foreach routine in array array['queue_application_followups','finish_application_analysis_job'] loop
  select pg_get_functiondef(p.oid) into definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname=routine;
  needle:=case when routine='queue_application_followups' then 'for criterion in' else 'for label in' end;
  if definition is null or position(needle in definition)=0 then raise exception 'Followup loop missing: %',routine; end if;
  definition:=replace(definition,needle,case when routine='queue_application_followups' then 'perform private.sync_profile_followups(p_job_id,p_youth_user_id);' else 'perform private.sync_profile_followups(p_job,p_youth);' end||E'\n '||needle);
  execute definition;
 end loop;
end; $$;
-- Correct wording only on unanswered language questions; preserve every answer.
update public.application_followups set question=private.application_followup_question(criterion_label)
 where status='pending' and criterion_label ~* '(svenska|engelska|spanska|språk)';
do $$ declare row_value record; begin
 for row_value in select distinct job_id,youth_user_id from public.application_followups where status='pending' loop
  perform private.sync_profile_followups(row_value.job_id,row_value.youth_user_id);
 end loop;
end; $$;
