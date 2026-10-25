-- DevStaging only. Synthetic jobs, all data/notifications and optional DDL roll back.
begin;
create temp table n02_results(label text);
grant all on n02_results to authenticated,anon;
create function pg_temp.check_test(label text,ok boolean) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAILED: %',label; end if;
 insert into n02_results values(label);
end $$;
create function pg_temp.deny(label text,statement text,state text default '42501') returns void language plpgsql as $$
declare denied boolean:=false; begin
 begin execute statement; exception when others then
   if sqlstate<>state then raise exception 'FAILED: %, expected %, got %: %',label,state,sqlstate,sqlerrm; end if;
   denied:=true;
 end;
 perform pg_temp.check_test(label,denied);
end $$;
create temp table n02_fixture(youth uuid,other_youth uuid,company uuid,draft uuid default gen_random_uuid(),sent uuid default gen_random_uuid(),matched uuid default gen_random_uuid(),hired uuid default gen_random_uuid(),paused uuid default gen_random_uuid(),match_id uuid,conversation_id uuid);
insert into n02_fixture(youth,other_youth,company)
select y.user_id,b.user_id,c.user_id from public.youth_profiles y
cross join public.youth_profiles b cross join public.company_profiles c
where y.full_name like 'QA %' and b.full_name ilike '%test%' and b.user_id<>y.user_id
 and c.company_name ilike 'QA %' and c.verification_status='verified' limit 1;
do $$ begin if not exists(select 1 from n02_fixture) then raise exception 'Missing clearly fictional QA actors'; end if; end $$;
grant select,update on n02_fixture to authenticated,anon;
create function pg_temp.f(key text) returns uuid language sql as $$ select (to_jsonb(f)->>key)::uuid from n02_fixture f $$;
create function pg_temp.actor(id uuid) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',coalesce(id::text,''),true);
 perform set_config('request.jwt.claims',case when id is null then '{}' else jsonb_build_object('sub',id,'role','authenticated')::text end,true);
end $$;
insert into public.jobs(id,company_user_id,company_name,title,description,status,is_active,publication_status)
select v.id,f.company,'QA N02 rollback','QA N02 rollback '||v.kind,'FIKTIVT QA-TEST','active',true,'published'
from n02_fixture f cross join lateral (values(f.draft,'draft'),(f.sent,'sent'),(f.matched,'matched'),(f.hired,'hired'),(f.paused,'paused')) v(id,kind);
update public.youth_profiles set cv_text='Fiktivt CV för transaktionellt QA-prov',cv_generated=true where user_id=pg_temp.f('youth');
insert into public.youth_application_drafts(youth_user_id,job_id) values(pg_temp.f('youth'),pg_temp.f('draft')),(pg_temp.f('youth'),pg_temp.f('paused'));
update public.jobs set status='paused',is_active=false where id=pg_temp.f('paused');

set local role anon;
select pg_temp.actor(null);
select pg_temp.deny('anonymous cannot withdraw','select public.withdraw_my_application('||quote_literal(pg_temp.f('draft'))||',false)');
set local role authenticated;
select pg_temp.actor(pg_temp.f('company'));
select pg_temp.deny('company cannot withdraw youth application','select public.withdraw_my_application('||quote_literal(pg_temp.f('draft'))||',false)');
select pg_temp.actor(pg_temp.f('other_youth'));
select pg_temp.deny('another youth cannot withdraw it','select public.withdraw_my_application('||quote_literal(pg_temp.f('draft'))||',false)');
select pg_temp.actor(pg_temp.f('youth'));
select pg_temp.deny('nonexistent own application denied','select public.withdraw_my_application(gen_random_uuid(),false)');
select pg_temp.check_test('pending interest withdrawn',public.withdraw_my_application(pg_temp.f('draft'),false)->>'status'='withdrawn');
select pg_temp.check_test('pending removed from auto-send list',not exists(select 1 from public.youth_application_drafts where job_id=pg_temp.f('draft')));
select pg_temp.check_test('withdrawal history readable',(select status='withdrawn' and withdrawn_at is not null from public.application_completions where job_id=pg_temp.f('draft')));
select pg_temp.check_test('retry is idempotent',public.withdraw_my_application(pg_temp.f('draft'),false)->>'status'='withdrawn');
select pg_temp.deny('stale draft write denied','insert into public.youth_application_drafts(youth_user_id,job_id) values('||quote_literal(pg_temp.f('youth'))||','||quote_literal(pg_temp.f('draft'))||')');
select pg_temp.deny('stale interested swipe denied','update public.swipe_actions set decision=''interested'' where job_id='||quote_literal(pg_temp.f('draft')));
select pg_temp.check_test('legacy prepare cannot resend',public.prepare_my_application(pg_temp.f('draft'),false)->>'status'='withdrawn');
select pg_temp.check_test('paused interest can be withdrawn',public.withdraw_my_application(pg_temp.f('paused'),false)->>'status'='withdrawn');
select pg_temp.check_test('CV draft flush sends nothing',(select sent_count=0 from public.submit_my_application_drafts()));
select pg_temp.check_test('new application submitted',public.prepare_my_application(pg_temp.f('sent'),false)->>'status'='submitted');
select pg_temp.deny('stale unsent confirmation requires fresh review','select public.withdraw_my_application('||quote_literal(pg_temp.f('sent'))||',false)','40001');
select pg_temp.check_test('stale confirmation leaves sent state intact',(select status='submitted' from public.application_completions where job_id=pg_temp.f('sent')));
select pg_temp.check_test('sent application withdrawn',public.withdraw_my_application(pg_temp.f('sent'),true)->>'status'='withdrawn');
select pg_temp.check_test('sent retry idempotent',public.withdraw_my_application(pg_temp.f('sent'),true)->>'status'='withdrawn');
select pg_temp.check_test('matched fixture submitted',public.prepare_my_application(pg_temp.f('matched'),false)->>'status'='submitted');
select pg_temp.check_test('hired fixture submitted',public.prepare_my_application(pg_temp.f('hired'),false)->>'status'='submitted');
select pg_temp.actor(pg_temp.f('company'));
select pg_temp.check_test('withdrawn completion hidden from company',not exists(select 1 from public.application_completions where job_id=pg_temp.f('sent')));
select pg_temp.check_test('withdrawn disclosure absent from candidate API',not exists(select 1 from public.get_company_candidates(pg_temp.f('sent'))));
select pg_temp.deny('company cannot rematch withdrawn applicant','select public.review_candidate_and_match('||quote_literal(pg_temp.f('sent'))||','||quote_literal(pg_temp.f('youth'))||',''interested'')');
with m as (select * from public.review_candidate_and_match(pg_temp.f('matched'),pg_temp.f('youth'),'interested'))
update n02_fixture set match_id=m.match_id,conversation_id=m.conversation_id from m;
select public.review_candidate_and_match(pg_temp.f('hired'),pg_temp.f('youth'),'interested');
select pg_temp.actor(pg_temp.f('youth'));
insert into public.messages(conversation_id,sender_user_id,message_text) values(pg_temp.f('conversation_id'),pg_temp.f('youth'),'FIKTIVT N02 rollbackprov');
select pg_temp.check_test('matched application withdrawn',public.withdraw_my_application(pg_temp.f('matched'),true)->>'match_id'=pg_temp.f('match_id')::text);
select pg_temp.check_test('match cancelled',(select status='cancelled' from public.matches where id=pg_temp.f('match_id')));
select pg_temp.check_test('chat history retained for youth',exists(select 1 from public.messages where conversation_id=pg_temp.f('conversation_id')));
select pg_temp.deny('youth cannot send after withdrawal','insert into public.messages(conversation_id,sender_user_id,message_text) values('||quote_literal(pg_temp.f('conversation_id'))||','||quote_literal(pg_temp.f('youth'))||',''must not send'')');
select pg_temp.actor(pg_temp.f('company'));
select pg_temp.check_test('chat history retained for company',exists(select 1 from public.messages where conversation_id=pg_temp.f('conversation_id')));
select pg_temp.deny('company cannot send after withdrawal','insert into public.messages(conversation_id,sender_user_id,message_text) values('||quote_literal(pg_temp.f('conversation_id'))||','||quote_literal(pg_temp.f('company'))||',''must not send'')');
select pg_temp.deny('company cannot revive cancelled match','update public.matches set status=''matched'' where id='||quote_literal(pg_temp.f('match_id')));
reset role;
select pg_temp.check_test('private draft did not notify company',not exists(select 1 from public.notifications where user_id=pg_temp.f('company') and title='Ansökan återkallad' and body like '%QA N02 rollback draft%'));
select pg_temp.check_test('sent withdrawal notified company exactly once',(select count(*)=1 from public.notifications where user_id=pg_temp.f('company') and title='Ansökan återkallad' and body like '%QA N02 rollback sent%'));
select pg_temp.check_test('background analysis is cancelled',not exists(select 1 from public.application_analysis_jobs where job_id in(pg_temp.f('draft'),pg_temp.f('sent'),pg_temp.f('matched')) and status<>'cancelled'));
select pg_temp.deny('older privileged writer cannot revive completion','update public.application_completions set status=''submitted'',withdrawn_at=null where job_id='||quote_literal(pg_temp.f('sent')));
update public.matches set status='hired' where job_id=pg_temp.f('hired');
set local role authenticated;
select pg_temp.actor(pg_temp.f('youth'));
select pg_temp.deny('registered hire cannot be undone by withdrawal','select public.withdraw_my_application('||quote_literal(pg_temp.f('hired'))||',true)');
select pg_temp.check_test('registered hire application unchanged',(select status='submitted' from public.application_completions where job_id=pg_temp.f('hired')));
reset role;
update public.matches set status='matched' where job_id=pg_temp.f('hired');
insert into public.employment_records(match_id,youth_user_id,company_user_id,company_name,role_name,start_date)
select id,youth_user_id,company_user_id,'QA N02 rollback','QA test',current_date from public.matches where job_id=pg_temp.f('hired');
set local role authenticated;
select pg_temp.actor(pg_temp.f('youth'));
select pg_temp.deny('employment evidence protects even an inconsistent match status','select public.withdraw_my_application('||quote_literal(pg_temp.f('hired'))||',true)');
select pg_temp.check_test('employment record preserved',exists(select 1 from public.employment_records where match_id in(select id from public.matches where job_id=pg_temp.f('hired'))));
reset role;
select jsonb_build_object('passed',count(*),'tests',jsonb_agg(label)) as n02_test_result from n02_results;
rollback;
