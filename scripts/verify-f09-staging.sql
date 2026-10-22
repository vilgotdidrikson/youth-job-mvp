-- Fictitious existing QA identities only. Everything, including the temporary
-- admin membership, verification changes and notifications, is rolled back.
begin;
do $$ begin
 if not exists(select 1 from public.youth_profiles where user_id='40416000-07aa-4416-9098-fb4be9928558' and full_name='Alex Testsson')
 or not exists(select 1 from public.company_profiles where user_id='120c7407-1e8a-488c-9047-f52d79325011' and company_name like 'QA Bistro%' and organization_number is not null)
 then raise exception 'F09 QA fixture unavailable'; end if;
end $$;
insert into public.admin_users(user_id) values('40416000-07aa-4416-9098-fb4be9928558') on conflict do nothing;
select set_config('request.jwt.claim.sub','40416000-07aa-4416-9098-fb4be9928558',true);
select set_config('request.jwt.claims','{"sub":"40416000-07aa-4416-9098-fb4be9928558","role":"authenticated"}',true);
set local role authenticated;
select public.review_company_verification('120c7407-1e8a-488c-9047-f52d79325011','rejected','QA F09 rollback test');
reset role;
create temporary table f09_fixture(kind text primary key,job uuid);
grant select,insert on f09_fixture to authenticated;
grant select on f09_fixture to anon;
select set_config('request.jwt.claim.sub','120c7407-1e8a-488c-9047-f52d79325011',true);
select set_config('request.jwt.claims','{"sub":"120c7407-1e8a-488c-9047-f52d79325011","role":"authenticated"}',true);
set local role authenticated;
with created as (insert into public.jobs(company_user_id,company_name,title,city,address,publication_status)
 values(auth.uid(),'QA Bistro – fictitious','QA F09 active rollback','QA','QA Jobbgatan 1','published') returning id)
insert into f09_fixture select 'active',id from created;
with created as (insert into public.jobs(company_user_id,company_name,title,city,address,status,is_active)
 values(auth.uid(),'QA Bistro – fictitious','QA F09 paused rollback','QA','QA Jobbgatan 2','paused',false) returning id)
insert into f09_fixture select 'paused',id from created;
with created as (insert into public.jobs(company_user_id,company_name,title,city,address,status,is_active)
 values(auth.uid(),'QA Bistro – fictitious','QA F09 closed rollback','QA','QA Jobbgatan 3','closed',false) returning id)
insert into f09_fixture select 'closed',id from created;
do $$ begin
 if (select count(*) from public.jobs where id in(select job from f09_fixture) and publication_status='pending_verification')<>3 then raise exception 'Unverified listing was published'; end if;
 begin perform public.review_company_verification(auth.uid(),'verified'); raise exception 'Company could approve itself'; exception when insufficient_privilege then null; end;
end $$;
update public.jobs set publication_status='published' where id=(select job from f09_fixture where kind='active');
do $$ begin
 if exists(select 1 from public.jobs where id in(select job from f09_fixture) and publication_status='published') then raise exception 'Owner bypassed publication gate'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin
 if exists(select 1 from public.jobs where id in(select job from f09_fixture)) then raise exception 'Waiting listing visible to public'; end if;
end $$;
reset role;
select set_config('request.jwt.claim.sub','40416000-07aa-4416-9098-fb4be9928558',true);
select set_config('request.jwt.claims','{"sub":"40416000-07aa-4416-9098-fb4be9928558","role":"authenticated"}',true);
set local role authenticated;
select public.review_company_verification('120c7407-1e8a-488c-9047-f52d79325011','verified');
reset role;
do $$ begin
 if not exists(select 1 from public.jobs where id=(select job from f09_fixture where kind='active') and publication_status='published' and status='active' and is_active) then raise exception 'Active listing did not publish on approval'; end if;
 if not exists(select 1 from public.jobs where id=(select job from f09_fixture where kind='paused') and publication_status='published' and status='paused' and not is_active) then raise exception 'Approval changed paused lifecycle'; end if;
 if not exists(select 1 from public.jobs where id=(select job from f09_fixture where kind='closed') and publication_status='published' and status='closed' and not is_active) then raise exception 'Approval changed closed lifecycle'; end if;
end $$;
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{"role":"anon"}',true);
set local role anon;
do $$ begin
 if (select count(*) from public.jobs where id in(select job from f09_fixture))<>1 then raise exception 'Public visibility differs from lifecycle'; end if;
 if exists(select 1 from public.jobs where id=(select job from f09_fixture where kind='paused')) then raise exception 'Paused listing became public'; end if;
end $$;
reset role;
select 'PASS F09: unverified insert, no owner bypass/self-approval, hidden waiting listings, automatic publication on admin approval, paused/closed lifecycle preserved; rollback' result;
rollback;
