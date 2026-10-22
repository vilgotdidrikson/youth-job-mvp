-- DEV only: own saved facts fill pending questions; no persisted test data.
begin;
create temp table ux_fixture as select j.id job,y.user_id youth from public.jobs j cross join public.youth_profiles y where private.application_analysis_eligible(j.id,y.user_id) limit 1;
do $$ declare job uuid; youth uuid; p jsonb; pending_start uuid; manual_start uuid; skipped_start uuid; language_id uuid; begin
 select f.job,f.youth into job,youth from ux_fixture f;
 if job is null then raise exception 'Missing DEV fixture'; end if;
 select recruitment_profile into p from public.youth_profiles where user_id=youth;
 p:=jsonb_set(p,'{availability,startDate}','"2026-10-14"');
 p:=jsonb_set(p,'{qualifications,languages}','[{"language":"Svenska","level":"Flytande"}]');
 update public.youth_profiles set recruitment_profile=p where user_id=youth;
 insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version) values(job,youth,md5('ux-pending-'||gen_random_uuid()::text),'Kan börja omgående (UX test)','När kan du börja?',1) returning id into pending_start;
 insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version,status,answer,answered_at) values(job,youth,md5('ux-manual-'||gen_random_uuid()::text),'Kan börja omgående (UX test)','När kan du börja?',1,'answered','Eget publicerat svar',now()) returning id into manual_start;
 insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version,status) values(job,youth,md5('ux-skipped-'||gen_random_uuid()::text),'Kan börja omgående (UX test)','När kan du börja?',1,'skipped') returning id into skipped_start;
 insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version) values(job,youth,md5('ux-language-'||gen_random_uuid()::text),'Svenska (UX test)','Vilken nivå?',1) returning id into language_id;
 perform private.sync_profile_followups(job,youth);
 if not exists(select 1 from public.application_followups where id=pending_start and status='answered' and answer like '%2026-10-14') then raise exception 'Start date not reused'; end if;
 if not exists(select 1 from public.application_followups where id=language_id and status='answered' and answer like '%Flytande') then raise exception 'Language not reused'; end if;
 if not exists(select 1 from public.application_followups where id=manual_start and answer='Eget publicerat svar') then raise exception 'Manual answer overwritten'; end if;
 if not exists(select 1 from public.application_followups where id=skipped_start and status='skipped') then raise exception 'Skipped answer overwritten'; end if;
 if has_function_privilege('authenticated','private.sync_profile_followups(uuid,uuid)','EXECUTE') or has_function_privilege('anon','private.sync_profile_followups(uuid,uuid)','EXECUTE') then raise exception 'Helper exposed'; end if;
end; $$;
select jsonb_build_object('passed',5,'checks',array['saved start date reused','saved language reused','manual answer preserved','skipped answer preserved','helper client access denied']);
rollback;
