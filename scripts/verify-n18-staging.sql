-- Fictitious, existing QA identities only. Always roll back.
begin;
do $$ begin
 if not exists(select 1 from public.youth_profiles where user_id='40416000-07aa-4416-9098-fb4be9928558' and full_name='Alex Testsson')
 or not exists(select 1 from public.company_profiles where user_id='120c7407-1e8a-488c-9047-f52d79325011' and company_name like 'QA Bistro%') then raise exception 'QA fixture identities changed'; end if;
end $$;
create temporary table n18_fixture(id uuid,first_time timestamptz);
grant select on n18_fixture to authenticated;
with job as (
 insert into public.jobs(company_user_id,company_name,title,city,address,postal_code,first_published_at)
 values('120c7407-1e8a-488c-9047-f52d79325011','QA Bistro – fictitious','QA N18 rollback only','QA','QA Gatan 1','11111','2099-01-01') returning id,first_published_at
) insert into n18_fixture select * from job;
do $$ begin
 if exists(select 1 from n18_fixture where first_time is null or first_time>'2090-01-01') then raise exception 'First publication not server controlled'; end if;
end $$;
update public.jobs set description='QA edited',first_published_at='2099-01-01' where id=(select id from n18_fixture);
update public.jobs set status='paused' where id=(select id from n18_fixture);
update public.jobs set status='active',first_published_at=null where id=(select id from n18_fixture);
do $$ begin
 if exists(select 1 from public.jobs j join n18_fixture f on j.id=f.id where j.first_published_at is distinct from f.first_time) then raise exception 'Publication was lifted'; end if;
end $$;
-- No CV is required for private decisions; do not modify submission RLS.
select set_config('request.jwt.claims','{"sub":"40416000-07aa-4416-9098-fb4be9928558","role":"authenticated"}',true);
select set_config('request.jwt.claim.sub','40416000-07aa-4416-9098-fb4be9928558',true);
set local role authenticated;
insert into public.youth_job_impressions(youth_user_id,job_id) select auth.uid(),id from n18_fixture on conflict do nothing;
insert into public.youth_job_impressions(youth_user_id,job_id) select auth.uid(),id from n18_fixture on conflict do nothing;
insert into public.youth_job_dismissals(youth_user_id,job_id) select auth.uid(),id from n18_fixture;
do $$ begin
 if (select count(*) from public.youth_job_impressions where job_id=(select id from n18_fixture))<>1 then raise exception 'Impression read/idempotence failed'; end if;
 begin
  insert into public.youth_job_impressions(youth_user_id,job_id,first_seen_at) select auth.uid(),id,now() from n18_fixture;
  raise exception 'Timestamp spoof permitted';
 exception when insufficient_privilege then null; end;
 begin
  insert into public.youth_job_impressions(youth_user_id,job_id) select '875c6885-ffbb-4a74-99a8-aac3cd194e84',id from n18_fixture;
  raise exception 'Foreign owner write permitted';
 exception when insufficient_privilege then null; end;
 begin
  delete from public.youth_job_dismissals where job_id=(select id from n18_fixture);
  raise exception 'Unapproved history delete permitted';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','120c7407-1e8a-488c-9047-f52d79325011',true);
select set_config('request.jwt.claims','{"sub":"120c7407-1e8a-488c-9047-f52d79325011","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.youth_job_impressions where job_id=(select id from n18_fixture)) or exists(select 1 from public.youth_job_dismissals where job_id=(select id from n18_fixture)) then raise exception 'Company can read youth state'; end if;
 begin
  insert into public.youth_job_impressions(youth_user_id,job_id) select auth.uid(),id from n18_fixture;
  raise exception 'Company can write youth state';
 exception when insufficient_privilege then null; end;
end $$;
reset role;
select set_config('request.jwt.claim.sub','875c6885-ffbb-4a74-99a8-aac3cd194e84',true);
select set_config('request.jwt.claims','{"sub":"875c6885-ffbb-4a74-99a8-aac3cd194e84","role":"authenticated"}',true);
set local role authenticated;
do $$ begin
 if exists(select 1 from public.youth_job_impressions where job_id=(select id from n18_fixture)) then raise exception 'Other youth reads state'; end if;
end $$;
reset role;
-- Job deletion cascades both private states.
select set_config('request.jwt.claim.sub','',true);
select set_config('request.jwt.claims','{}',true);
delete from public.jobs where id=(select id from n18_fixture);
do $$ begin
 if exists(select 1 from public.youth_job_impressions where job_id=(select id from n18_fixture)) or exists(select 1 from public.youth_job_dismissals where job_id=(select id from n18_fixture)) then raise exception 'Cascade failed'; end if;
end $$;
select 'PASS N18 ownership, no company access, idempotence, server time, private choices, immutable publication and cascade; all rolled back' as result;
rollback;
