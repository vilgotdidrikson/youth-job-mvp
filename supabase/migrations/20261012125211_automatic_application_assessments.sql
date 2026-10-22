-- Durable, coalescing queue. No task can make a recruiting decision.
create table public.application_analysis_jobs (
 job_id uuid not null references public.jobs(id) on delete cascade,
 youth_user_id uuid not null references auth.users(id) on delete cascade,
 generation bigint not null default 1,
 status text not null default 'pending' check(status in ('pending','processing','completed','failed','cancelled')),
 attempts integer not null default 0,
 available_at timestamptz not null default now(),locked_at timestamptz,lock_token uuid,
 completed_input_hash text,updated_at timestamptz not null default now(),error_code text,
 primary key(job_id,youth_user_id)
);
alter table public.application_analysis_jobs enable row level security;
revoke all on table public.application_analysis_jobs from anon,authenticated;
grant all on table public.application_analysis_jobs to service_role;
create index application_analysis_ready_idx on public.application_analysis_jobs(available_at) where status in ('pending','failed','processing');
create index application_analysis_youth_idx on public.application_analysis_jobs(youth_user_id);

create or replace function private.application_analysis_eligible(p_job uuid,p_youth uuid)
returns boolean language sql stable security definer set search_path = '' as $$
select exists(select 1 from public.jobs j join public.company_profiles cp on cp.user_id=j.company_user_id
 join public.application_completions a on a.job_id=j.id and a.youth_user_id=p_youth and a.status='submitted'
 join public.swipe_actions s on s.job_id=j.id and s.youth_user_id=p_youth and s.decision='interested'
 join public.job_match_profiles m on m.job_id=j.id and m.status='approved'
 where j.id=p_job and j.status='active' and j.is_active and j.publication_status='published' and cp.verification_status='verified'
 and not public.users_are_blocked(j.company_user_id,p_youth)
 and not exists(select 1 from public.company_interest_actions d where d.job_id=j.id and d.youth_user_id=p_youth and d.decision='skip')
 and not exists(select 1 from public.matches mt where mt.job_id=j.id and mt.youth_user_id=p_youth and mt.status in ('hired','rejected','cancelled')));
$$;
revoke all on function private.application_analysis_eligible(uuid,uuid) from public,anon,authenticated;

create or replace function private.enqueue_application_analysis(p_job uuid,p_youth uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 if not private.application_analysis_eligible(p_job,p_youth) then return; end if;
 insert into public.application_analysis_jobs(job_id,youth_user_id,available_at) values(p_job,p_youth,now()+interval '10 seconds')
 on conflict(job_id,youth_user_id) do update set generation=application_analysis_jobs.generation+1,
 status=case when application_analysis_jobs.status='processing' then 'processing' else 'pending' end,
 attempts=0,available_at=now()+interval '10 seconds',updated_at=now(),error_code=null;
end; $$;
revoke all on function private.enqueue_application_analysis(uuid,uuid) from public,anon,authenticated;

create or replace function private.queue_changed_application_analysis()
returns trigger language plpgsql security definer set search_path = '' as $$
declare pair record;
begin
 if tg_table_name='youth_profiles' then
   if tg_op='UPDATE' and row(new.cv_text,new.cv_structured,new.documents,new.work_experience,new.education,new.languages,new.employment_preferences,new.certificates,new.extracurriculars,new.recruitment_profile) is distinct from row(old.cv_text,old.cv_structured,old.documents,old.work_experience,old.education,old.languages,old.employment_preferences,old.certificates,old.extracurriculars,old.recruitment_profile) then
     for pair in select job_id from public.application_completions where youth_user_id=new.user_id and status='submitted' loop perform private.enqueue_application_analysis(pair.job_id,new.user_id); end loop;
   end if;
 elsif tg_table_name='job_match_profiles' then
   if tg_op='INSERT' or row(new.profile_version,new.status) is distinct from row(old.profile_version,old.status) then
     for pair in select youth_user_id from public.application_completions where job_id=new.job_id and status='submitted' loop perform private.enqueue_application_analysis(new.job_id,pair.youth_user_id); end loop;
   end if;
 elsif tg_table_name='application_completions' then
   if new.status='submitted' and (tg_op='INSERT' or row(new.status,new.answers,new.omitted_question_ids) is distinct from row(old.status,old.answers,old.omitted_question_ids)) then perform private.enqueue_application_analysis(new.job_id,new.youth_user_id); end if;
 elsif tg_table_name='application_followups' then
   if tg_op='UPDATE' and row(new.status,new.answer) is distinct from row(old.status,old.answer) then perform private.enqueue_application_analysis(new.job_id,new.youth_user_id); end if;
 end if;
 return new;
end; $$;
revoke all on function private.queue_changed_application_analysis() from public,anon,authenticated;
create trigger queue_youth_profile_analysis after update on public.youth_profiles for each row execute function private.queue_changed_application_analysis();
create trigger queue_job_profile_analysis after insert or update on public.job_match_profiles for each row execute function private.queue_changed_application_analysis();
create trigger queue_application_analysis after insert or update on public.application_completions for each row execute function private.queue_changed_application_analysis();
create trigger queue_answer_analysis after update on public.application_followups for each row execute function private.queue_changed_application_analysis();

create or replace function public.request_application_assessment(p_job_id uuid,p_youth_user_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
begin
 perform public.get_candidate_assessment_input(p_job_id,p_youth_user_id); -- existing authorization boundary
 if not private.application_analysis_eligible(p_job_id,p_youth_user_id) then return; end if;
 insert into public.application_analysis_jobs(job_id,youth_user_id) values(p_job_id,p_youth_user_id) on conflict do nothing;
end; $$;
revoke all on function public.request_application_assessment(uuid,uuid) from public,anon;
grant execute on function public.request_application_assessment(uuid,uuid) to authenticated;

create or replace function public.get_application_assessment_state(p_job_id uuid,p_youth_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare task public.application_analysis_jobs; result jsonb;
begin
 perform public.get_candidate_assessment_input(p_job_id,p_youth_user_id);
 select * into task from public.application_analysis_jobs where job_id=p_job_id and youth_user_id=p_youth_user_id;
 if task.status='completed' then select ca.result into result from public.candidate_assessments ca where ca.job_id=p_job_id and ca.youth_user_id=p_youth_user_id and ca.input_hash=task.completed_input_hash order by ca.created_at desc limit 1; end if;
 return jsonb_build_object('status',coalesce(task.status,'unrequested'),'assessment',result,'updated_at',task.updated_at,'retrying',task.status='failed' and task.attempts<5);
end; $$;
revoke all on function public.get_application_assessment_state(uuid,uuid) from public,anon;
grant execute on function public.get_application_assessment_state(uuid,uuid) to authenticated;

create or replace function public.claim_application_analysis_jobs()
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare task record; results jsonb:='[]'; profile_input jsonb; match_profile public.job_match_profiles;
begin
 update public.application_analysis_jobs set status='failed',lock_token=null,error_code='worker_timeout' where status='processing' and attempts>=5 and locked_at<now()-interval '2 minutes';
 for task in select * from public.application_analysis_jobs where attempts<5 and ((status in ('pending','failed') and available_at<=now()) or (status='processing' and locked_at<now()-interval '2 minutes')) order by available_at,job_id,youth_user_id limit 2 for update skip locked loop
   if not private.application_analysis_eligible(task.job_id,task.youth_user_id) then update public.application_analysis_jobs set status='cancelled',lock_token=null,updated_at=now() where job_id=task.job_id and youth_user_id=task.youth_user_id; continue; end if;
   select * into match_profile from public.job_match_profiles where job_id=task.job_id;
   select jsonb_build_object('cv_text',y.cv_text,'cv_structured',y.cv_structured,'recruitment_profile',y.recruitment_profile,'documents',y.documents,'work_experience',y.work_experience,'education',y.education,'languages',y.languages,'employment_preferences',y.employment_preferences,'certificates',y.certificates,'extracurriculars',y.extracurriculars,
     'answers',a.answers,'followup_answers',coalesce((select jsonb_agg(jsonb_build_object('answer',f.answer)) from public.application_followups f where f.job_id=task.job_id and f.youth_user_id=task.youth_user_id and f.status='answered'),'[]')) into profile_input from public.youth_profiles y join public.application_completions a on a.youth_user_id=y.user_id and a.job_id=task.job_id where y.user_id=task.youth_user_id;
   update public.application_analysis_jobs set status='processing',attempts=attempts+1,locked_at=now(),lock_token=gen_random_uuid(),error_code=null where job_id=task.job_id and youth_user_id=task.youth_user_id returning lock_token into task.lock_token;
   results:=results||jsonb_build_array(jsonb_build_object('jobId',task.job_id,'youthId',task.youth_user_id,'generation',task.generation,'lockToken',task.lock_token,'profile',profile_input,'criteria',match_profile.weighted_criteria,'version',match_profile.profile_version));
 end loop;
 return results;
end; $$;
revoke all on function public.claim_application_analysis_jobs() from public,anon,authenticated;
grant execute on function public.claim_application_analysis_jobs() to service_role;
grant usage on schema private to service_role;
grant execute on function private.application_analysis_eligible(uuid,uuid) to service_role;

create or replace function public.finish_application_analysis_job(p_job uuid,p_youth uuid,p_generation bigint,p_token uuid,p_hash text,p_result jsonb,p_criteria jsonb,p_missing jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare task public.application_analysis_jobs; job public.jobs; m public.job_match_profiles; completion public.application_completions; label text; total integer; inserted integer; queued integer:=0; question text; normalized text;
begin
 select * into task from public.application_analysis_jobs where job_id=p_job and youth_user_id=p_youth for update;
 if not found or task.status<>'processing' or task.lock_token is distinct from p_token then return jsonb_build_object('stale',true); end if;
 if task.generation<>p_generation then update public.application_analysis_jobs set status='pending',lock_token=null,attempts=0 where job_id=p_job and youth_user_id=p_youth; return jsonb_build_object('stale',true); end if;
 if not private.application_analysis_eligible(p_job,p_youth) then update public.application_analysis_jobs set status='cancelled',lock_token=null where job_id=p_job and youth_user_id=p_youth; return jsonb_build_object('cancelled',true); end if;
 if p_hash !~ '^[a-f0-9]{64}$' or jsonb_typeof(p_result)<>'object' or jsonb_typeof(p_criteria)<>'array' or jsonb_typeof(p_missing)<>'array' then raise exception 'Invalid assessment result' using errcode='22023'; end if;
 select * into job from public.jobs where id=p_job;
 select * into m from public.job_match_profiles where job_id=p_job;
 select * into completion from public.application_completions where job_id=p_job and youth_user_id=p_youth;
 insert into public.candidate_assessments(job_id,youth_user_id,company_user_id,job_profile_version,input_hash,result,criteria_snapshot) values(p_job,p_youth,job.company_user_id,m.profile_version,p_hash,p_result,p_criteria) on conflict do nothing;
 select count(*) into total from public.application_followups where job_id=p_job and youth_user_id=p_youth;
 for label in select value from jsonb_array_elements_text(p_missing) limit 3 loop
   if total>=6 then exit; end if;
   if label ~* '(ålder|födelse|kön|etni|relig|häls|diagnos|funktions|medborg|nationalitet|gravid|sexuell|personnummer|politisk|facklig|familj|civilstånd)' or not exists(select 1 from jsonb_array_elements(m.weighted_criteria) c where c->>'label'=label and c->>'category' not in ('trait','trainable')) then continue; end if;
   normalized:=md5(lower(regexp_replace(btrim(label),'\s+',' ','g')));
   question:=case when label ~* '(helg|arbetstid|tillgäng|börja|kväll|dagtid|omgående)' then 'Vilka tider kan du arbeta och när kan du börja? Annonsens önskemål: '||label||'.' else 'Vad vill du lägga till om ”'||label||'”? Beskriv gärna dina kunskaper eller ge ett konkret exempel från jobb, skola eller fritid.' end;
   insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version) values(p_job,p_youth,normalized,label,question,m.profile_version) on conflict do nothing;
   get diagnostics inserted=row_count;total:=total+inserted;queued:=queued+inserted;
 end loop;
 if queued>0 then insert into public.notifications(user_id,type,title,body,href) values(p_youth,'application_update','Nya frågor till din ansökan','Du kan komplettera ansökan till '||completion.job_title||'. Frågorna är frivilliga och ansökan är redan skickad.','/applications?job='||p_job::text); end if;
 update public.application_analysis_jobs set status='completed',lock_token=null,completed_input_hash=p_hash,updated_at=now(),error_code=null where job_id=p_job and youth_user_id=p_youth;
 return jsonb_build_object('completed',true,'queued',queued);
end; $$;
revoke all on function public.finish_application_analysis_job(uuid,uuid,bigint,uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.finish_application_analysis_job(uuid,uuid,bigint,uuid,text,jsonb,jsonb,jsonb) to service_role;

create or replace function public.fail_application_analysis_job(p_job uuid,p_youth uuid,p_generation bigint,p_token uuid)
returns void language sql security invoker set search_path = '' as $$
update public.application_analysis_jobs set status=case when generation=p_generation then 'failed' else 'pending' end,attempts=case when generation=p_generation then attempts else 0 end,lock_token=null,available_at=now()+interval '1 minute'*least(16,power(2,least(attempts,4))),error_code='temporarily_unavailable',updated_at=now() where job_id=p_job and youth_user_id=p_youth and lock_token=p_token and status='processing';
$$;
revoke all on function public.fail_application_analysis_job(uuid,uuid,bigint,uuid) from public,anon,authenticated;
grant execute on function public.fail_application_analysis_job(uuid,uuid,bigint,uuid) to service_role;

-- Cron credentials are encrypted in Vault, never exposed to the frontend.
create extension if not exists pg_net;
do $$ begin if not exists(select 1 from vault.secrets where name='mnw_matching_worker_token') then perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'mnw_matching_worker_token'); end if; end; $$;
create table private.matching_worker_config(singleton boolean primary key default true check(singleton),endpoint text not null default '',enabled boolean not null default false);
alter table private.matching_worker_config enable row level security;
revoke all on table private.matching_worker_config from public,anon,authenticated;
insert into private.matching_worker_config(singleton) values(true);
create or replace function public.validate_matching_worker_token(p_token text)
returns boolean language sql stable security definer set search_path = '' as $$ select length(p_token)=64 and p_token=(select decrypted_secret from vault.decrypted_secrets where name='mnw_matching_worker_token' limit 1); $$;
revoke all on function public.validate_matching_worker_token(text) from public,anon,authenticated;
grant execute on function public.validate_matching_worker_token(text) to service_role;
create or replace function private.dispatch_matching_worker()
returns void language plpgsql security definer set search_path = '' as $$ declare endpoint text; begin
 select c.endpoint into endpoint from private.matching_worker_config c where c.singleton and c.enabled;
 if endpoint is null or endpoint='' or not exists(select 1 from public.application_analysis_jobs where attempts<5 and ((status in ('pending','failed') and available_at<=now()) or (status='processing' and locked_at<now()-interval '2 minutes'))) then return; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='mnw_matching_worker_token' limit 1)),body:='{}',timeout_milliseconds:=60000);
end; $$;
revoke all on function private.dispatch_matching_worker() from public,anon,authenticated;
select cron.schedule('mnw-application-assessment-worker','* * * * *','select private.dispatch_matching_worker()');
