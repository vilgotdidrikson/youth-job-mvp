-- DevStaging only. Synthetic jobs, all data/notifications and optional DDL roll back.
begin;
create temp table n07_results(label text);
grant all on n07_results to authenticated,anon;
create function pg_temp.check_test(label text,ok boolean) returns void language plpgsql as $$ begin
 if ok is distinct from true then raise exception 'FAILED: %',label; end if;
 insert into n07_results values(label);
end $$;
create function pg_temp.deny(label text,statement text,state text default '42501') returns void language plpgsql as $$
declare denied boolean:=false; begin
 begin execute statement; exception when others then
   if sqlstate<>state then raise exception 'FAILED: %, expected %, got %: %',label,state,sqlstate,sqlerrm; end if;
   denied:=true;
 end;
 perform pg_temp.check_test(label,denied);
end $$;
create temp table n07_fixture(youth uuid,other_youth uuid,company uuid,draft uuid default gen_random_uuid(),sent uuid default gen_random_uuid(),matched uuid default gen_random_uuid(),hired uuid default gen_random_uuid(),paused uuid default gen_random_uuid(),match_id uuid,conversation_id uuid);
insert into n07_fixture(youth,other_youth,company)
select y.user_id,b.user_id,c.user_id from public.youth_profiles y
cross join public.youth_profiles b cross join public.company_profiles c
where y.full_name like 'QA %' and b.full_name ilike '%test%' and b.user_id<>y.user_id
 and c.company_name ilike 'QA %' and c.verification_status='verified' limit 1;
do $$ begin if not exists(select 1 from n07_fixture) then raise exception 'Missing clearly fictional QA actors'; end if; end $$;
grant select,update on n07_fixture to authenticated,anon;
create function pg_temp.f(key text) returns uuid language sql as $$ select (to_jsonb(f)->>key)::uuid from n07_fixture f $$;
create function pg_temp.actor(id uuid) returns void language plpgsql as $$ begin
 perform set_config('request.jwt.claim.sub',coalesce(id::text,''),true);
 perform set_config('request.jwt.claims',case when id is null then '{}' else jsonb_build_object('sub',id,'role','authenticated')::text end,true);
end $$;
insert into public.jobs(id,company_user_id,company_name,title,description,status,is_active,publication_status)
select v.id,f.company,'QA N07 rollback','QA N07 rollback '||v.kind,'FIKTIVT QA-TEST','active',true,'published'
from n07_fixture f cross join lateral (values(f.draft,'draft'),(f.sent,'sent'),(f.matched,'matched'),(f.hired,'hired'),(f.paused,'paused')) v(id,kind);
update public.youth_profiles set cv_text='Fiktivt CV för transaktionellt QA-prov',cv_generated=true where user_id=pg_temp.f('youth');
create temp table n07_tokens(job_id uuid primary key,token timestamptz);
grant all on n07_tokens to authenticated;
set local role anon;
select pg_temp.actor(null);
select pg_temp.deny('anonymous denied','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('draft'))||')');
set local role authenticated;
select pg_temp.actor(pg_temp.f('company'));
select pg_temp.deny('company denied','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('draft'))||')');
select pg_temp.actor(pg_temp.f('youth'));
select pg_temp.deny('missing job denied','select public.set_my_discovery_dismissal(gen_random_uuid())');
select pg_temp.deny('null job denied','select public.set_my_discovery_dismissal(null)','22023');
insert into public.youth_job_impressions(youth_user_id,job_id) values(pg_temp.f('youth'),pg_temp.f('draft'));
insert into public.youth_saved_jobs(youth_user_id,job_id) values(pg_temp.f('youth'),pg_temp.f('draft'));
insert into n07_tokens select pg_temp.f('draft'),(public.set_my_discovery_dismissal(pg_temp.f('draft'))->>'undo_token')::timestamptz;
select pg_temp.check_test('dismissal persisted',exists(select 1 from public.youth_job_dismissals where job_id=pg_temp.f('draft')));
select pg_temp.check_test('skip creates no application',not exists(select 1 from public.application_completions where job_id=pg_temp.f('draft')));
select pg_temp.check_test('skip creates no swipe',not exists(select 1 from public.swipe_actions where job_id=pg_temp.f('draft')));
select pg_temp.actor(pg_temp.f('other_youth'));
select pg_temp.check_test('other youth sees no dismissal',not exists(select 1 from public.youth_job_dismissals where job_id=pg_temp.f('draft')));
select pg_temp.deny('other youth cannot undo token','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('draft'))||','||quote_literal((select token::text from n07_tokens where job_id=pg_temp.f('draft')))||')','40001');
select pg_temp.actor(pg_temp.f('youth'));
select pg_temp.deny('wrong token denied','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('draft'))||',now())','40001');
select pg_temp.check_test('wrong token leaves dismissal',exists(select 1 from public.youth_job_dismissals where job_id=pg_temp.f('draft')));
select pg_temp.check_test('undo succeeds',public.set_my_discovery_dismissal(pg_temp.f('draft'),(select token from n07_tokens where job_id=pg_temp.f('draft')))->>'status'='restored');
select pg_temp.check_test('dismissal absent',not exists(select 1 from public.youth_job_dismissals where job_id=pg_temp.f('draft')));
select pg_temp.check_test('seen history preserved',exists(select 1 from public.youth_job_impressions where job_id=pg_temp.f('draft')));
select pg_temp.check_test('bookmark preserved',exists(select 1 from public.youth_saved_jobs where job_id=pg_temp.f('draft')));
select pg_temp.deny('replay denied','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('draft'))||','||quote_literal((select token::text from n07_tokens where job_id=pg_temp.f('draft')))||')','40001');
update n07_tokens set token=(public.set_my_discovery_dismissal(job_id)->>'undo_token')::timestamptz;
select pg_temp.deny('old token cannot undo new choice','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('draft'))||',now())','40001');
insert into n07_tokens select pg_temp.f('sent'),(public.set_my_discovery_dismissal(pg_temp.f('sent'))->>'undo_token')::timestamptz;
select pg_temp.deny('older dismissal cannot undo past latest','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('draft'))||','||quote_literal((select token::text from n07_tokens where job_id=pg_temp.f('draft')))||')','40001');
select pg_temp.check_test('newest dismissal can undo',public.set_my_discovery_dismissal(pg_temp.f('sent'),(select token from n07_tokens where job_id=pg_temp.f('sent')))->>'status'='restored');
reset role;
update public.jobs set status='paused',is_active=false where id=pg_temp.f('draft');
set local role authenticated;
select pg_temp.check_test('paused dismissal can be removed without reviving job',public.set_my_discovery_dismissal(pg_temp.f('draft'),(select token from n07_tokens where job_id=pg_temp.f('draft')))->>'status'='restored');
select pg_temp.check_test('paused job remains invisible',not exists(select 1 from public.jobs where id=pg_temp.f('draft')));
select pg_temp.deny('cannot dismiss paused listing','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('draft'))||')');
select pg_temp.check_test('application fixture submitted',public.prepare_my_application(pg_temp.f('matched'),false)->>'status'='submitted');
select pg_temp.deny('skip cannot overwrite sent application','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('matched'))||')');
select pg_temp.check_test('withdrawal fixture',public.withdraw_my_application(pg_temp.f('matched'),true)->>'status'='withdrawn');
select pg_temp.deny('undo cannot bypass withdrawn tombstone','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('matched'))||',now())');
select pg_temp.check_test('withdrawal remains',(select status='withdrawn' from public.application_completions where job_id=pg_temp.f('matched')));
reset role;
update public.youth_profiles set cv_text='',cv_generated=false,cv_uploaded=false,documents='[]'::jsonb where user_id=pg_temp.f('youth');
set local role authenticated;
insert into n07_tokens select pg_temp.f('hired'),(public.set_my_discovery_dismissal(pg_temp.f('hired'))->>'undo_token')::timestamptz;
select pg_temp.check_test('without CV can dismiss',exists(select 1 from public.youth_job_dismissals where job_id=pg_temp.f('hired')));
select pg_temp.check_test('without CV can undo',public.set_my_discovery_dismissal(pg_temp.f('hired'),(select token from n07_tokens where job_id=pg_temp.f('hired')))->>'status'='restored');
insert into public.youth_application_drafts(youth_user_id,job_id) values(pg_temp.f('youth'),pg_temp.f('hired'));
select pg_temp.deny('pending interest protected','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('hired'))||')');
reset role;
set local role authenticated;
select pg_temp.actor(pg_temp.f('company'));
select pg_temp.check_test('company sees no private dismissal',not exists(select 1 from public.youth_job_dismissals where job_id=pg_temp.f('draft')));
select pg_temp.actor(pg_temp.f('youth'));
insert into public.user_blocks(blocker_user_id,blocked_user_id) values(pg_temp.f('youth'),pg_temp.f('company'));
select pg_temp.deny('blocked company dismissal denied','select public.set_my_discovery_dismissal('||quote_literal(pg_temp.f('sent'))||')');
reset role;
select pg_temp.check_test('public wrapper invoker',(select not prosecdef from pg_proc where oid='public.set_my_discovery_dismissal(uuid,timestamptz)'::regprocedure));
select count(*) as assertions,jsonb_agg(label) as passed from n07_results;
rollback;
