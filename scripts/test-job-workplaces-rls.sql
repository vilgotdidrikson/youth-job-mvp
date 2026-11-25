-- DevStaging only. All changes to fictional QA fixtures roll back.
begin;
do $$
declare
 youth uuid := '40416000-07aa-4416-9098-fb4be9928558';
 company uuid := '120c7407-1e8a-488c-9047-f52d79325011';
 outsider uuid := '875c6885-ffbb-4a74-99a8-aac3cd194e84';
 job uuid := '765be68c-7d32-4bc5-859d-6a077ff81a8b';
 first_id uuid:=gen_random_uuid(); second_id uuid:=gen_random_uuid();
 places jsonb; affected int; snapshot jsonb;
begin
 if not exists(select 1 from public.youth_profiles where user_id=youth and full_name='Alex Testsson') or
 not exists(select 1 from public.jobs where id=job and company_user_id=company and title like 'QA TEST%') then
 raise exception 'Refusing non-fictional fixtures'; end if;
 places:=jsonb_build_array(jsonb_build_object('id',first_id,'name','QA City','address','QA Gatan 1','postal_code','11111','city','Stockholm','longitude',18.06,'latitude',59.33),jsonb_build_object('id',second_id,'name','QA Väst','address','QA Gatan 2','postal_code','22222','city','Göteborg','longitude',11.97,'latitude',57.7));
 update public.jobs set status='active',is_active=true,publication_status='published' where id=job;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 update public.jobs set workplaces=places where id=job;
 if (select address from public.jobs where id=job)<>'QA Gatan 1' then raise exception 'FAIL primary address sync'; end if;
 begin
 update public.jobs set workplaces=jsonb_build_array(places->0,places->0) where id=job;
 raise exception 'FAIL duplicate workplace accepted'; exception when check_violation then null; end;
 begin
 update public.jobs set workplaces='{}' where id=job;
 raise exception 'FAIL non-array accepted'; exception when check_violation then null; end;
 begin
 update public.jobs set workplaces=jsonb_build_array((places->0)||'{"longitude":181}') where id=job;
 raise exception 'FAIL invalid coordinates accepted'; exception when check_violation then null; end;
 begin
 update public.jobs set workplaces='[]' where id=job;
 raise exception 'FAIL last workplace removed'; exception when check_violation then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub',youth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.swipe_actions(youth_user_id,job_id,decision) values(youth,job,'interested') on conflict(youth_user_id,job_id) do update set decision='interested';
 insert into public.application_workplace_preferences(job_id,youth_user_id,workplace_id,workplace_snapshot)
 values(job,youth,second_id,'{"forged":true}') on conflict(job_id,youth_user_id) do update set workplace_id=excluded.workplace_id;
 select workplace_snapshot into snapshot from public.application_workplace_preferences where job_id=job and youth_user_id=youth;
 if snapshot->>'address'<>'QA Gatan 2' or snapshot?'forged' then raise exception 'FAIL server snapshot'; end if;
 begin
 insert into public.application_workplace_preferences(job_id,youth_user_id,workplace_id) values(job,outsider,first_id);
 raise exception 'FAIL foreign preference write'; exception when insufficient_privilege then null; end;
 begin
 update public.application_workplace_preferences set workplace_id=gen_random_uuid() where job_id=job and youth_user_id=youth;
 raise exception 'FAIL unknown workplace accepted'; exception when check_violation then null; end;
 reset role;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 if not exists(select 1 from public.application_workplace_preferences where job_id=job and youth_user_id=youth) then raise exception 'FAIL company cannot read submitted preference'; end if;
 update public.application_workplace_preferences set workplace_id=first_id where job_id=job and youth_user_id=youth;
 get diagnostics affected=row_count; if affected<>0 then raise exception 'FAIL company modified youth preference'; end if;
 update public.jobs set workplaces=jsonb_build_array(places->0) where id=job;
 if (select workplace_snapshot from public.application_workplace_preferences where job_id=job and youth_user_id=youth) is distinct from snapshot then raise exception 'FAIL removed place snapshot lost'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',outsider::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',outsider,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.application_workplace_preferences where job_id=job) then raise exception 'FAIL outsider read'; end if;
 update public.jobs set workplaces=places where id=job;
 get diagnostics affected=row_count; if affected<>0 then raise exception 'FAIL foreign job updated'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub','',true);
 perform set_config('request.jwt.claims','{"role":"anon"}',true);
 set local role anon;
 begin
 perform * from public.application_workplace_preferences;
 raise exception 'FAIL anonymous preference read'; exception when insufficient_privilege then null; end;
 reset role;
 raise notice 'PASS N14 RLS: owner jobs, input validation, snapshot, applicant write, company read only, outsider/anonymous denial, removed workplace history';
end $$;
rollback;
