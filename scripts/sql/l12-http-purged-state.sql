-- DevStaging fixture-only POST-purge state for HTTP verification. This does not
-- invoke/activate the worker or modify enforcement/schedules. The actual worker
-- is separately covered by the rollback suite. Four UUID placeholders are from
-- l12-http-fixture; only its hidden fictional job/conversation may be changed.
begin;
create temporary table l12_http_result(result jsonb) on commit drop;
do $$
declare
 qa_youth uuid:='__YOUTH_ID__'; qa_company uuid:='__COMPANY_ID__'; qa_job uuid:='__JOB_ID__'; qa_conversation uuid:='__CONVERSATION_ID__';
 other_job uuid; original_packet jsonb;
begin
 if not exists(select 1 from auth.users where id=qa_youth and email='qa-l12-http-'||qa_youth||'@example.invalid')
  or not exists(select 1 from auth.users where id=qa_company and email='qa-l12-http-'||qa_company||'@example.invalid') then raise exception 'Not disposable QA'; end if;
 perform 1 from private.data_retention_config where singleton and not applications_enabled and not chats_enabled for share;
 if not found or exists(select 1 from cron.job where jobname='mnw-data-retention' and active) then raise exception 'Unexpected active configuration'; end if;
 perform 1 from public.jobs where id=qa_job and company_user_id=qa_company and title='QA L12 HTTP active' and publication_status='pending_verification' for update;
 if not found or not exists(select 1 from public.conversations where id=qa_conversation and job_id=qa_job and youth_user_id=qa_youth and company_user_id=qa_company) then raise exception 'QA relationship mismatch'; end if;
 if exists(select 1 from public.application_completions where job_id=qa_job and youth_user_id<>qa_youth)
  or exists(select 1 from public.matches where job_id=qa_job and youth_user_id<>qa_youth) then raise exception 'Foreign applicant; refusing'; end if;
 select j.id,d.packet into other_job,original_packet from public.jobs j join private.application_disclosures d on d.job_id=j.id and d.youth_user_id=qa_youth
  where j.company_user_id=qa_company and j.title='QA L12 HTTP no applicant';
 if other_job is null then raise exception 'Independent control missing'; end if;
 insert into public.recruitment_outcomes(job_id,company_user_id,outcome) values(qa_job,qa_company,'no_hire');
 update public.jobs set status='closed',is_active=false where id=qa_job;
 delete from public.application_analysis_jobs where job_id=qa_job and youth_user_id=qa_youth;
 delete from public.application_followups where job_id=qa_job and youth_user_id=qa_youth;
 delete from public.candidate_assessments where job_id=qa_job and youth_user_id=qa_youth;
 delete from public.application_workplace_preferences where job_id=qa_job and youth_user_id=qa_youth;
 delete from private.application_disclosures where job_id=qa_job and youth_user_id=qa_youth;
 delete from public.youth_application_drafts where job_id=qa_job and youth_user_id=qa_youth;
 delete from public.application_completions where job_id=qa_job and youth_user_id=qa_youth;
 update private.application_retention set closed_at=statement_timestamp()-interval '6 months',delete_after=statement_timestamp(),purged_at=statement_timestamp() where job_id=qa_job and youth_user_id=qa_youth;
 delete from public.messages where conversation_id=qa_conversation;
 delete from public.notifications n using public.conversations c where c.id=qa_conversation and n.match_id=c.match_id and n.type='message';
 update private.conversation_retention set last_activity_at=statement_timestamp()-interval '12 months',read_only_at=statement_timestamp()-interval '6 months',delete_after=statement_timestamp(),purged_at=statement_timestamp() where conversation_id=qa_conversation;
 if (select d.packet from private.application_disclosures d where d.job_id=other_job and d.youth_user_id=qa_youth) is distinct from original_packet then raise exception 'Control changed'; end if;
 if not exists(select 1 from storage.objects where bucket_id='youth-documents' and name=qa_youth::text||'/qa-l12-http.pdf') then raise exception 'Original CV lost'; end if;
 insert into l12_http_result values(jsonb_build_object('fixture_post_purge_prepared',true,'worker_invoked',false,'config_changed',false,'original_and_control_preserved',true));
end $$;
select result from l12_http_result;
commit;
