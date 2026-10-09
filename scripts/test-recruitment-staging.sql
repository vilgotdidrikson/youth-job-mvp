-- Run ONLY against MatchnWork DevStaging. Everything, including notifications,
-- is rolled back. Uses existing participants without changing their passwords.
begin;
create temp table recruitment_test_results(test text,passed boolean);
grant insert,select on recruitment_test_results to authenticated,anon;
create function pg_temp.assert_test(label text,condition boolean) returns void language plpgsql as $$
begin
  if condition is distinct from true then raise exception 'TEST FAILED: %',label; end if;
  insert into recruitment_test_results values(label,true);
end; $$;
create function pg_temp.expect_error(label text,statement text,expected_state text default '42501') returns void language plpgsql as $$
declare caught boolean:=false;
begin
  begin execute statement; exception when others then
    if sqlstate<>expected_state then raise exception 'TEST FAILED: %, expected %, got %: %',label,expected_state,sqlstate,sqlerrm; end if;
    caught:=true;
  end;
  perform pg_temp.assert_test(label,caught);
end; $$;
create function pg_temp.actor(actor_id uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub',coalesce(actor_id::text,''),true);
  perform set_config('request.jwt.claims',case when actor_id is null then '{}' else json_build_object('sub',actor_id,'role','authenticated')::text end,true);
end; $$;
do $$
declare fixture record; company_b uuid; youth_b uuid; admin_id uuid;
begin
  select m.* into fixture from public.matches m
    join public.company_profiles cp on cp.user_id=m.company_user_id
    join public.conversations c on c.match_id=m.id
    where m.status='matched' and cp.verification_status='verified'
      and not public.is_admin_account(m.youth_user_id)
      and not public.users_are_blocked(m.company_user_id,m.youth_user_id)
      and not exists(select 1 from public.employment_records e where e.match_id=m.id)
    order by m.created_at desc limit 1;
  if fixture.id is null then raise exception 'No eligible staging match fixture'; end if;
  select id into company_b from public.profiles where role='company' and id<>fixture.company_user_id and not public.is_admin_account(id) limit 1;
  select id into youth_b from public.profiles where role='youth' and id<>fixture.youth_user_id and not public.is_admin_account(id) limit 1;
  select user_id into admin_id from public.admin_users limit 1;
  if company_b is null or youth_b is null or admin_id is null then raise exception 'Missing staging actors'; end if;
  perform set_config('mnw.test_fixture',json_build_object('match',fixture.id,'job',fixture.job_id,'company',fixture.company_user_id,'youth',fixture.youth_user_id,'company_b',company_b,'youth_b',youth_b,'admin',admin_id)::text,true);
end; $$;
create function pg_temp.fixture(key text) returns uuid language sql as $$ select (current_setting('mnw.test_fixture')::jsonb->>key)::uuid; $$;

-- An unanswered new match also gets an employer followup after fourteen days.
insert into public.recruitment_followups(match_id,opened_at) values(pg_temp.fixture('match'),now()-interval '15 days')
  on conflict(match_id) do update set opened_at=excluded.opened_at,requested_at=null,reminder_sent_at=null,review_state='open';
select private.process_recruitment_reminders();
select pg_temp.assert_test('automatic employer followup after fourteen days',(select reminder_sent_at is not null from public.recruitment_followups where match_id=pg_temp.fixture('match')));
set local role authenticated;
select pg_temp.actor(pg_temp.fixture('company'));
select public.recruitment_action('company_reply',pg_temp.fixture('match'),'{"reply":"ongoing"}');
select pg_temp.expect_error('repeat company reply cannot spam notifications','select public.recruitment_action(''company_reply'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{"reply":"ongoing"}'')','22023');
reset role;
select pg_temp.assert_test('reply resolves automatic followup',(select review_state='resolved' from public.recruitment_followups where match_id=pg_temp.fixture('match')));

set local role anon;
select pg_temp.actor(null);
select pg_temp.expect_error('anonymous cannot read recruitment RPC','select public.get_recruitment_records()');
select pg_temp.expect_error('anonymous cannot access verification','select public.get_verified_experience('||quote_literal(pg_temp.fixture('youth'))||'::uuid)');
select pg_temp.expect_error('anonymous cannot register hire','select public.recruitment_action(''register'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{}'')');

set local role authenticated;
select pg_temp.actor(pg_temp.fixture('youth'));
select pg_temp.expect_error('youth cannot originate employment','select public.recruitment_action(''register'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{"role_name":"Test","start_date":"2026-10-09"}'')');
select public.recruitment_action('request',pg_temp.fixture('match'));
select pg_temp.expect_error('weekly reminder limit','select public.recruitment_action(''request'','||quote_literal(pg_temp.fixture('match'))||'::uuid)','22023');
select public.recruitment_action('report',pg_temp.fixture('match'),'{"details":"Rollback test: work started, no registration."}');
select pg_temp.expect_error('duplicate open report rejected','select public.recruitment_action(''report'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{"details":"Repeated rollback test report"}'')','22023');
select pg_temp.assert_test('report does not create employment',not exists(select 1 from public.employment_records where match_id=pg_temp.fixture('match')));
select pg_temp.assert_test('report does not mark hired',(select status='matched' from public.matches where id=pg_temp.fixture('match')));
select pg_temp.assert_test('report does not restrict employer',not exists(select 1 from public.company_recruitment_controls where company_user_id=pg_temp.fixture('company') and restriction<>'none'));
select pg_temp.expect_error('youth cannot self-approve without employer record','select public.recruitment_action(''respond'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{"response":"approved"}'')');
select pg_temp.expect_error('youth cannot set company restriction','select public.recruitment_action(''restrict'',null,''{}'')');
select pg_temp.expect_error('youth cannot write employment table','update public.employment_records set response=''approved''');
select pg_temp.expect_error('client cannot run reminder processor','select private.process_recruitment_reminders()');

select pg_temp.actor(pg_temp.fixture('company_b'));
select pg_temp.expect_error('other company cannot register','select public.recruitment_action(''register'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{"role_name":"Test","start_date":"2026-10-09"}'')');
select pg_temp.assert_test('other company cannot list this match',not exists(select 1 from jsonb_array_elements(public.get_recruitment_records()) r where r->>'match_id'=pg_temp.fixture('match')::text));

select pg_temp.actor(pg_temp.fixture('company'));
select pg_temp.assert_test('employer cannot read private report text',(select r->>'report_details' is null from jsonb_array_elements(public.get_recruitment_records()) r where r->>'match_id'=pg_temp.fixture('match')::text));
select pg_temp.expect_error('legacy endpoint cannot bypass employment fields','select public.mark_match_hired('||quote_literal(pg_temp.fixture('match'))||'::uuid)');
select public.recruitment_action('register',pg_temp.fixture('match'),'{"role_name":"Rollback test assistant","start_date":"2026-10-09"}');
select pg_temp.assert_test('employer registration marks hired',(select status='hired' from public.matches where id=pg_temp.fixture('match')));
select pg_temp.assert_test('registration alone grants no badge',jsonb_array_length(public.get_verified_experience(pg_temp.fixture('youth'),pg_temp.fixture('job')))=0);
select pg_temp.expect_error('employer cannot approve for youth','select public.recruitment_action(''respond'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{"response":"approved"}'')');
select pg_temp.expect_error('employer cannot mark fee paid','update public.employment_records set paid_at=now() where match_id='||quote_literal(pg_temp.fixture('match'))||'::uuid');
select pg_temp.expect_error('employer cannot erase hire history','delete from public.jobs where id='||quote_literal(pg_temp.fixture('job'))||'::uuid');

select pg_temp.actor(pg_temp.fixture('youth_b'));
select pg_temp.expect_error('other youth cannot approve','select public.recruitment_action(''respond'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{"response":"approved"}'')');
select pg_temp.assert_test('other youth cannot read employment row',not exists(select 1 from public.employment_records where match_id=pg_temp.fixture('match')));
select pg_temp.expect_error('other youth cannot read verified experience','select public.get_verified_experience('||quote_literal(pg_temp.fixture('youth'))||'::uuid)');

select pg_temp.actor(pg_temp.fixture('youth'));
select public.recruitment_action('respond',pg_temp.fixture('match'),'{"response":"disputed"}');
select pg_temp.assert_test('dispute clears verification',jsonb_array_length(public.get_verified_experience(pg_temp.fixture('youth')))=0);
select pg_temp.actor(pg_temp.fixture('company'));
select public.recruitment_action('register',pg_temp.fixture('match'),'{"role_name":"Corrected rollback role","start_date":"2026-10-10"}');
select pg_temp.assert_test('correction requires new youth approval',(select response='pending' from public.employment_records where match_id=pg_temp.fixture('match')));

-- Advance pending date solely inside this rollback transaction.
reset role;
update public.employment_records set registered_at=now()-interval '8 days' where match_id=pg_temp.fixture('match');
select private.process_recruitment_reminders();
select pg_temp.assert_test('pending employment gets reminder',(select reminder_sent_at is not null from public.recruitment_followups where match_id=pg_temp.fixture('match')));
select pg_temp.assert_test('pending employment escalates after seven days',(select escalated_at is not null from public.recruitment_followups where match_id=pg_temp.fixture('match')));
select private.process_recruitment_reminders();
select pg_temp.assert_test('reminder is not duplicated',(select count(*)=1 from public.notifications where user_id=pg_temp.fixture('youth') and title='Påminnelse om anställning' and href='/chats?job='||pg_temp.fixture('job')::text and created_at>=transaction_timestamp()));

set local role authenticated;
select pg_temp.actor(pg_temp.fixture('youth'));
select public.recruitment_action('respond',pg_temp.fixture('match'),'{"response":"approved","show_on_profile":false,"include_in_cv":false}');
select pg_temp.assert_test('youth can approve without public sharing',(select response='approved' and not show_on_profile and not include_in_cv from public.employment_records where match_id=pg_temp.fixture('match')));
select pg_temp.actor(pg_temp.fixture('company'));
select pg_temp.assert_test('hidden experience is not disclosed',jsonb_array_length(public.get_verified_experience(pg_temp.fixture('youth'),pg_temp.fixture('job')))=0);
select pg_temp.actor(pg_temp.fixture('youth'));
select public.recruitment_action('respond',pg_temp.fixture('match'),'{"response":"approved","show_on_profile":true,"include_in_cv":true}');
select pg_temp.assert_test('approved experience exists without payment',(select response='approved' and show_on_profile and include_in_cv and paid_at is null from public.employment_records where match_id=pg_temp.fixture('match')));
select pg_temp.actor(pg_temp.fixture('company'));
select pg_temp.assert_test('authorized company sees approved shared experience',exists(select 1 from jsonb_array_elements(public.get_verified_experience(pg_temp.fixture('youth'),pg_temp.fixture('job'))) r where r->>'match_id'=pg_temp.fixture('match')::text));
select pg_temp.expect_error('approved employment cannot be silently rewritten','select public.recruitment_action(''register'','||quote_literal(pg_temp.fixture('match'))||'::uuid,''{"role_name":"Changed","start_date":"2026-10-10"}'')','22023');
select pg_temp.expect_error('direct closing cannot bypass outcome','update public.jobs set status=''closed'' where id='||quote_literal(pg_temp.fixture('job'))||'::uuid','22023');
select pg_temp.expect_error('cannot claim no hire after registered hire','select public.recruitment_action(''close_job'',null,'||quote_literal(json_build_object('job_id',pg_temp.fixture('job'),'outcome','no_hire')::text)||'::jsonb)','22023');

select pg_temp.actor(pg_temp.fixture('admin'));
select public.recruitment_action('review',pg_temp.fixture('match'),'{"state":"reviewing","notes":"Rollback test: contacted both parties."}');
select pg_temp.assert_test('admin can view internal notes',exists(select 1 from jsonb_array_elements(public.get_recruitment_records()) r where r->>'match_id'=pg_temp.fixture('match')::text and r->>'admin_notes' like 'Rollback test:%'));
select pg_temp.expect_error('restriction requires review confirmation','select public.recruitment_action(''restrict'',null,'||quote_literal(json_build_object('company_user_id',pg_temp.fixture('company'),'restriction','limited','reason','Rollback test review completed')::text)||'::jsonb)','22023');
select public.recruitment_action('restrict',null,jsonb_build_object('company_user_id',pg_temp.fixture('company'),'restriction','limited','reason','Rollback test review completed','review_confirmed',true));
select pg_temp.actor(pg_temp.fixture('company'));
select pg_temp.expect_error('restricted company cannot create new ad','insert into public.jobs(company_user_id,title,description,city) values('||quote_literal(pg_temp.fixture('company'))||'::uuid,''Rollback test'',''Test'',''Stockholm'')');
select pg_temp.expect_error('restricted company cannot open new candidate contact','insert into public.company_interest_actions(company_user_id,youth_user_id,job_id,decision) values('||quote_literal(pg_temp.fixture('company'))||'::uuid,'||quote_literal(pg_temp.fixture('youth_b'))||'::uuid,'||quote_literal(pg_temp.fixture('job'))||'::uuid,''interested'')');
select pg_temp.assert_test('restriction does not remove existing chats',exists(select 1 from public.conversations where match_id=pg_temp.fixture('match')));
insert into public.messages(conversation_id,sender_user_id,message_text) select id,pg_temp.fixture('company'),'Rollback test: existing chat remains usable' from public.conversations where match_id=pg_temp.fixture('match');
select pg_temp.assert_test('restricted company can still send in existing chat',exists(select 1 from public.messages where sender_user_id=pg_temp.fixture('company') and message_text='Rollback test: existing chat remains usable' and created_at>=transaction_timestamp()));
select pg_temp.assert_test('employer cannot read admin notes',(select r->>'admin_notes' is null from jsonb_array_elements(public.get_recruitment_records()) r where r->>'match_id'=pg_temp.fixture('match')::text));
select public.recruitment_action('close_job',null,jsonb_build_object('job_id',pg_temp.fixture('job'),'outcome','hired'));
select pg_temp.expect_error('restricted company cannot republish','update public.jobs set status=''active'' where id='||quote_literal(pg_temp.fixture('job'))||'::uuid');
select pg_temp.actor(pg_temp.fixture('admin'));
select public.recruitment_action('restrict',null,jsonb_build_object('company_user_id',pg_temp.fixture('company'),'restriction','none','reason','Rollback test case resolved','review_confirmed',true));
select pg_temp.actor(pg_temp.fixture('company'));
update public.jobs set status='active' where id=pg_temp.fixture('job');
select pg_temp.assert_test('restored company can republish',(select status='active' from public.jobs where id=pg_temp.fixture('job')));
select pg_temp.assert_test('republishing resets prior outcome',not exists(select 1 from public.recruitment_outcomes where job_id=pg_temp.fixture('job')));

reset role;
select pg_temp.assert_test('discount remains disabled',(select status='disabled' and discount_percent is null from public.recruitment_rewards where match_id=pg_temp.fixture('match')));
select pg_temp.expect_error('future discount cannot unlock before payment','update public.recruitment_rewards set status=''available'',discount_percent=20 where match_id='||quote_literal(pg_temp.fixture('match'))||'::uuid','22023');
update public.employment_records set paid_at=now() where match_id=pg_temp.fixture('match');
update public.recruitment_rewards set status='available',discount_percent=20,expires_at=now()+interval '6 months' where match_id=pg_temp.fixture('match');
select pg_temp.assert_test('future billing integration can unlock after payment',(select status='available' from public.recruitment_rewards where match_id=pg_temp.fixture('match')));
select pg_temp.assert_test('weekly request is auditable',exists(select 1 from public.recruitment_audit where match_id=pg_temp.fixture('match') and action='request'));
select jsonb_build_object('passed',count(*),'failed',count(*) filter(where not passed),'checks',jsonb_agg(test order by test)) as recruitment_test_result from recruitment_test_results;
rollback;
