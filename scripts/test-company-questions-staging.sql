-- DevStaging only; all synthetic identities, questions, reports, flags and purges roll back.
begin;
create temporary table n24_results(result jsonb);
create function pg_temp.n24_assert(label text,condition boolean) returns void language plpgsql as $$begin if condition is distinct from true then raise exception 'N24 FAILED: %',label; end if; end;$$;
create function pg_temp.n24_denied(statement text,expected text default '42501',fragment text default null) returns void language plpgsql as $$
declare caught boolean:=false;
begin
 begin execute statement; exception when others then
  if sqlstate<>expected or (fragment is not null and position(fragment in sqlerrm)=0) then raise exception 'N24 wrong failure: % %',sqlstate,sqlerrm; end if; caught:=true;
 end;
 if not caught then raise exception 'N24 expected denial: %',statement; end if;
end;$$;
do $$
declare u uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); outsider uuid:=gen_random_uuid(); d uuid:=gen_random_uuid(); admin uuid:=gen_random_uuid();
 j uuid:=gen_random_uuid(); j2 uuid:=gen_random_uuid(); cap uuid:=gen_random_uuid(); pend uuid:=gen_random_uuid(); daily uuid:=gen_random_uuid(); foreign_job uuid:=gen_random_uuid();
 job uuid; request uuid:=gen_random_uuid(); qid uuid; second uuid; reported uuid; result jsonb; packet jsonb; before_profile jsonb; bulk_ids uuid[]:='{}'; bulk_answers jsonb:='{}'; bulk_id uuid; n int; checks text[]:='{}';
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (u,'qa-n24-'||u||'@example.invalid','{"role":"youth"}'),(c,'qa-n24-'||c||'@example.invalid','{"role":"company"}'),
 (outsider,'qa-n24-'||outsider||'@example.invalid','{"role":"youth"}'),(d,'qa-n24-'||d||'@example.invalid','{"role":"company"}'),(admin,'qa-n24-'||admin||'@example.invalid','{"role":"private"}');
 insert into public.admin_users(user_id) values(admin);
 perform set_config('request.jwt.claim.sub',admin::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 update public.company_profiles set company_name='QA N24 fictional',verification_status='verified' where user_id in(c,d);
 update public.youth_profiles set full_name='QA N24 youth',cv_generated=true,cv_text='QA N24 CV: jag har serviceerfarenhet.' where user_id=u;
 select to_jsonb(y) into before_profile from public.youth_profiles y where user_id=u;
 foreach job in array array[j,j2,cap,pend,daily,foreign_job] loop
  insert into public.jobs(id,company_user_id,company_name,title,description,address) values(job,case when job=foreign_job then d else c end,'QA N24','QA N24 ad','QA fictional work','QA Testgatan 1');
  insert into public.job_match_profiles(job_id,status,role_summary,weighted_criteria,candidate_questions) values(job,'approved','QA role','[]','[]');
 end loop;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 foreach job in array array[j,j2,cap,pend,daily,foreign_job] loop
  packet:=public.get_my_application_disclosure_preview(job,'{}');perform public.save_my_application_disclosure(job,'{}',packet->>'source_token');perform public.prepare_my_application(job,false);
 end loop;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j,u,'Youth cannot ask',request));
 reset role;
 perform set_config('request.jwt.claim.sub',c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',foreign_job,u,'Wrong ad',request));
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j,outsider,'No application',request));
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j,u,repeat('x',501),request),'22023');
 result:=public.create_company_application_question(j,u,'Kan du ge ett exempel på service från praktiken?',request);qid:=(result->>'id')::uuid;
 perform pg_temp.n24_assert('company source and scope',result->>'question_source'='company' and result->>'asked_by'=c::text and result->>'youth_user_id'=u::text);
 perform pg_temp.n24_assert('idempotent request',(public.create_company_application_question(j,u,'Kan du ge ett exempel på service från praktiken?',request)->>'id')=qid::text);
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j,u,'Changed question',request),'PT409');
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j,u,'Kan du ge ett exempel på service från praktiken?',gen_random_uuid()),'PT409','finns redan');
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j,u,'En annan fråga?',gen_random_uuid()),'PT409','minut');
 result:=public.create_company_application_question(j2,u,'Vilka arbetsuppgifter hade du i skolan?',gen_random_uuid());second:=(result->>'id')::uuid;
 reset role;
 perform pg_temp.n24_assert('one new question notification',(select count(*)=1 from public.notifications where user_id=u and title='Fråga från företaget' and href='/applications?job='||j::text));
 perform pg_temp.n24_assert('no match or chat created',not exists(select 1 from public.matches where youth_user_id=u) and not exists(select 1 from public.conversations where youth_user_id=u));
 checks:=array_append(checks,'owner/submitted/length gates; idempotency, duplicate and minute rate; exact youth notification; no match/chat');
 perform set_config('request.jwt.claim.sub',d::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',d,'role','authenticated')::text,true);
 set local role authenticated;
 perform pg_temp.n24_assert('other company cannot read',(select count(*)=0 from public.application_followups where id=qid));
 perform pg_temp.n24_denied(format('select public.report_application_question(%L,%L,null)',qid,'other'));
 reset role;
 perform set_config('request.jwt.claim.sub',outsider::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 set local role authenticated;
 perform pg_temp.n24_assert('other youth cannot read',(select count(*)=0 from public.application_followups where id=qid));
 perform pg_temp.n24_denied(format('select public.save_my_application_followup_answers(%L,%L::jsonb)',j,jsonb_build_object(qid::text,'Wrong youth')));
 perform pg_temp.n24_denied(format('select public.report_application_question(%L,%L,null)',qid,'other'));
 reset role;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{}',true);
 set local role anon;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j,u,'Anonymous',request));
 perform pg_temp.n24_denied(format('select public.report_application_question(%L,%L,null)',qid,'other'));
 reset role;
 checks:=array_append(checks,'real anonymous/other-company/other-youth RLS and RPC denials');
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 perform public.save_my_application_supplement(j,'{}','{}',jsonb_build_object(qid::text,'Jag hjälpte kunder på min praktik.'),'{}');
 perform public.save_my_application_supplement(j,'{}','{}',jsonb_build_object(qid::text,'Jag hjälpte kunder på min praktik.'),'{}');
 perform public.save_my_application_supplement(j2,'{}','{}','{}',array[second]);
 reported:=public.report_application_question(qid,'inappropriate','QA fictional report');
 perform pg_temp.n24_assert('report retry idempotent',public.report_application_question(qid,'inappropriate','QA fictional report')=reported);
 perform pg_temp.n24_denied(format('update public.application_followups set question=%L where id=%L','Changed',qid));
 reset role;
 perform pg_temp.n24_assert('answer and skip states',(select status='answered' and answer='Jag hjälpte kunder på min praktik.' from public.application_followups where id=qid) and (select status='skipped' and answer='' from public.application_followups where id=second));
 perform pg_temp.n24_assert('profile unchanged',(select to_jsonb(y)=before_profile from public.youth_profiles y where user_id=u));
 perform pg_temp.n24_assert('answer notification once',(select count(*)=1 from public.notifications where user_id=c and title='Ansökan kompletterad' and href='/company?view=kandidater&job='||j::text||'&candidate='||u::text));
 perform pg_temp.n24_assert('report snapshot scoped',(select target_type='application_question' and target_snapshot->>'question'='Kan du ge ett exempel på service från praktiken?' and not(target_snapshot ? 'answer') from public.moderation_reports where id=reported));
 perform pg_temp.n24_denied(format('update public.application_followups set question=%L where id=%L','Immutable even from stale worker',qid),'PT409');
 checks:=array_append(checks,'answer/skip without profile or match mutation; repeated answer notification dedupe; immutable question; private scoped report snapshot');
 -- Blocking and verification changes are checked again on each new action.
 insert into public.user_blocks(blocker_user_id,blocked_user_id) values(u,c);
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.save_my_application_followup_answers(%L,%L::jsonb)',j,jsonb_build_object(qid::text,'Blocked correction')));
 reset role;
 perform set_config('request.jwt.claim.sub',c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',daily,u,'Blocked question',gen_random_uuid()));
 reset role;delete from public.user_blocks where blocker_user_id=u and blocked_user_id=c;
 perform set_config('request.jwt.claim.sub',admin::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 update public.company_profiles set verification_status='pending' where user_id=c;
 perform set_config('request.jwt.claim.sub',c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',daily,u,'Unverified question',gen_random_uuid()));
 reset role;
 perform set_config('request.jwt.claim.sub',admin::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',admin,'role','authenticated')::text,true);
 update public.company_profiles set verification_status='verified' where user_id=c;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 checks:=array_append(checks,'block stops questions and answers; revoking company verification stops questions');
 -- Existing pause behavior allows answering, but no new employer question.
 update public.jobs set status='paused',is_active=false where id=j2;
 perform set_config('request.jwt.claim.sub',c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j2,u,'Paused new question',gen_random_uuid()));
 reset role;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 perform public.save_my_application_followup_answers(j2,jsonb_build_object(second::text,'Jag vill komplettera mitt svar.'));
 reset role;
 insert into public.recruitment_outcomes(job_id,company_user_id,outcome) values(j2,c,'no_hire');update public.jobs set status='closed',is_active=false where id=j2;
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.save_my_application_followup_answers(%L,%L::jsonb)',j2,jsonb_build_object(second::text,'Closed correction')));
 reset role;
 update public.application_completions set status='withdrawn',withdrawn_at=now() where job_id=j and youth_user_id=u;
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.save_my_application_followup_answers(%L,%L::jsonb)',j,jsonb_build_object(qid::text,'Withdrawn correction')));
 reset role;
 perform set_config('request.jwt.claim.sub',c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j,u,'Withdrawn new question',gen_random_uuid()));
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',j2,u,'Closed new question',gen_random_uuid()));
 reset role;
 -- Trusted rollback fixture rows test limits without waiting or changing clocks in production code.
 for n in 1..5 loop
  insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version,status,created_at,question_source,asked_by,request_key)
  values(cap,u,'qa-cap-'||n,'QA','QA cap '||n,1,'skipped',now()-interval '2 days','company',c,gen_random_uuid());
 end loop;
 for n in 1..2 loop
  insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version,created_at,question_source,asked_by,request_key)
  values(pend,u,'qa-pending-'||n,'QA','QA pending '||n,1,now()-interval '2 minutes','company',c,gen_random_uuid());
 end loop;
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',cap,u,'Exceeds five',gen_random_uuid()),'PT409','fem');
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',pend,u,'Exceeds two pending',gen_random_uuid()),'PT409','två');
 reset role;
 for n in 1..20 loop
  insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version,status,created_at,question_source,asked_by,request_key)
  values(cap,u,'qa-daily-'||n,'QA','QA daily '||n,1,'skipped',now()-interval '2 minutes','company',c,gen_random_uuid());
 end loop;
 set local role authenticated;
 perform pg_temp.n24_denied(format('select public.create_company_application_question(%L,%L,%L,%L)',daily,u,'Exceeds rolling day',gen_random_uuid()),'PT409','dygnet');
 reset role;
 checks:=array_append(checks,'closed/withdrawn writes stop; paused answers preserve existing behavior; two pending/five total/20 per rolling day enforced');
 -- Six automatic questions plus five company questions can coexist on one application.
 for n in 1..11 loop
  bulk_id:=gen_random_uuid();bulk_ids:=array_append(bulk_ids,bulk_id);bulk_answers:=bulk_answers||jsonb_build_object(bulk_id::text,repeat('å',1500));
  insert into public.application_followups(id,job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version,question_source,asked_by,request_key)
  values(bulk_id,daily,u,'qa-bulk-'||n,'QA','QA bulk '||n,1,case when n<=6 then 'automatic' else 'company' end,case when n>6 then c end,case when n>6 then gen_random_uuid() end);
 end loop;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 perform public.save_my_application_supplement(daily,'{}','{}','{}',bulk_ids);
 perform pg_temp.n24_assert('all eleven can be skipped',(select count(*)=11 from public.application_followups where job_id=daily and status='skipped'));
 perform public.save_my_application_supplement(daily,'{}','{}',bulk_answers,'{}');
 perform pg_temp.n24_assert('all eleven full Swedish answers',(select count(*)=11 from public.application_followups where job_id=daily and status='answered' and length(answer)=1500));
 reset role;
 checks:=array_append(checks,'combined six automatic/five employer questions accept bulk skip and full Swedish answers');
 -- Enable only within this rolled-back, targeted fixture to verify L12 removes new rows too.
 update private.data_retention_config set applications_enabled=true,policy_reference='QA N24 rollback only',policy_reviewed_at=now(),legacy_reviewed_at=now();
 update private.application_retention set closed_at=now()-interval '7 months',delete_after=now()-interval '1 day' where job_id=j and youth_user_id=u;
 perform set_config('request.jwt.claim.sub',u::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 perform pg_temp.n24_assert('expired questions hidden',(select count(*)=0 from public.application_followups where job_id=j));
 perform pg_temp.n24_denied(format('select public.report_application_question(%L,%L,null)',qid,'other'));
 reset role;
 perform private.process_data_retention(25,j,null);
 perform pg_temp.n24_assert('manual rows purged',not exists(select 1 from public.application_followups where job_id=j));
 perform pg_temp.n24_assert('report evidence not lost',(select target_snapshot->>'question'='Kan du ge ett exempel på service från praktiken?' from public.moderation_reports where id=reported));
 checks:=array_append(checks,'exact retention denial; targeted L12 purges manual questions; separate moderation evidence retained');
 insert into n24_results values(jsonb_build_object('groups',checks,'passed',array_length(checks,1)));
end;$$;
select result from n24_results;
rollback;
