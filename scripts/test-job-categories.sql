-- DevStaging only; every fixture/write is rolled back. No real recruitment.
begin;
do $$
declare company uuid:='120c7407-1e8a-488c-9047-f52d79325011';
 youth uuid:='40416000-07aa-4416-9098-fb4be9928558';
 job uuid:=gen_random_uuid(); affected integer; stamp timestamptz; p jsonb; saved jsonb; version integer;
begin
 if not exists(select 1 from public.company_profiles where user_id=company and company_name like 'QA Bistro%' and verification_status='verified')
 or not exists(select 1 from public.youth_profiles where user_id=youth and full_name='Alex Testsson') then
 raise exception 'Missing fictional QA fixtures; refusing writes'; end if;
 perform set_config('request.jwt.claim.sub',company::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',company,'role','authenticated')::text,true);
 set local role authenticated;
 insert into public.jobs(id,company_user_id,company_name,title,description,category,city,address,postal_code,longitude,latitude,job_category_ids,job_category_manual)
 values(job,company,'QA Bistro','Cafémedarbetare','Fiktivt N17-test','caféjobb','Stockholm','Testgatan 1','11111',18,59,array['cafe'],false);
 select created_at into stamp from public.jobs where id=job;
 update public.jobs set job_category_ids=array['finance'],job_category_manual=true where id=job;
 if not exists(select 1 from public.jobs where id=job and title='Cafémedarbetare' and category='caféjobb'
 and job_category_ids=array['finance'] and job_category_manual and created_at=stamp) then raise exception 'FAIL correction/original text/publication time'; end if;
 begin
 update public.jobs set job_category_ids=array['unknown'] where id=job;
 raise exception 'FAIL unknown id'; exception when check_violation then null; end;
 begin
 update public.jobs set job_category_ids=array['cafe','cafe'] where id=job;
 raise exception 'FAIL duplicate id'; exception when check_violation then null; end;
 begin
 update public.jobs set job_category_ids=array['cafe','retail','finance','warehouse'] where id=job;
 raise exception 'FAIL too many ids'; exception when check_violation then null; end;
 update public.jobs set job_category_ids='{}',job_category_manual=true where id=job;
 if not exists(select 1 from public.jobs where id=job and cardinality(job_category_ids)=0 and job_category_manual) then raise exception 'FAIL unknown role cannot remain'; end if;
 update public.jobs set category='',title='Okänd fri roll' where id=job;
 if not exists(select 1 from public.jobs where id=job and category='' and title='Okänd fri roll') then raise exception 'FAIL free unknown role blocked'; end if;
 reset role;
 perform set_config('request.jwt.claim.sub',youth::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 update public.jobs set job_category_ids=array['cafe'] where id=job;
 get diagnostics affected=row_count;
 if affected<>0 then raise exception 'FAIL foreign category update'; end if;
 select recruitment_profile,recruitment_profile_version into p,version from public.youth_profiles where user_id=youth;
 -- Existing four-key preferences remain valid and unchanged until explicit save.
 if not public.valid_recruitment_profile(p) then raise exception 'FAIL old profile incompatible'; end if;
 p:=jsonb_set(p,'{preferences}',jsonb_build_object('roles',jsonb_build_array('söker caféjobb'),'categoryIds',jsonb_build_array('cafe'),'locations','[]'::jsonb,'travelMinutes','','motivation',''));
 if not public.valid_recruitment_profile(p) then raise exception 'FAIL new profile ids invalid'; end if;
 saved:=public.save_my_recruitment_profile('preferences',p->'preferences',version);
 if saved->'profile'->'preferences'->'categoryIds'<>'["cafe"]'::jsonb
 or saved->'profile'->'preferences'->'roles'<>'["söker caféjobb"]'::jsonb then raise exception 'FAIL preference/raw save'; end if;
 p:=jsonb_set(p,'{preferences,categoryIds}','["unknown"]'::jsonb);
 if public.valid_recruitment_profile(p) then raise exception 'FAIL invalid preference id'; end if;
 p:=jsonb_set(p,'{preferences,categoryIds}','["cafe","cafe"]'::jsonb);
 if public.valid_recruitment_profile(p) then raise exception 'FAIL duplicate preference id'; end if;
 reset role;
end $$;
rollback;
select 'PASS N17: category constraints, own/foreign edits, preserved title/raw category/date, unknown role, compatible profile/raw text and canonical preference save. All writes rolled back.' as result;
