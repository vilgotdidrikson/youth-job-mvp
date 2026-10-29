-- Run ONLY in DevStaging. All identities and rows are transient and rolled back.
-- No passwords, sessions, Auth API signup or persistent test accounts are used.
begin;
select set_config('qa.prefix','qa-l13-private-transaction',true);
select set_config('qa.youth_a',gen_random_uuid()::text,true);
select set_config('qa.youth_b',gen_random_uuid()::text,true);
select set_config('qa.company',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role)
values(current_setting('qa.youth_a')::uuid,current_setting('qa.prefix')||'-a@example.invalid','{"role":"youth"}','{}','authenticated','authenticated'),
(current_setting('qa.youth_b')::uuid,current_setting('qa.prefix')||'-b@example.invalid','{"role":"youth"}','{}','authenticated','authenticated'),
(current_setting('qa.company')::uuid,current_setting('qa.prefix')||'-c@example.invalid','{"role":"company"}','{}','authenticated','authenticated');
do $$
declare a uuid:=current_setting('qa.youth_a')::uuid;
 b uuid:=current_setting('qa.youth_b')::uuid;
 c uuid:=current_setting('qa.company')::uuid;
 j1 uuid:=gen_random_uuid(); j2 uuid:=gen_random_uuid(); j3 uuid:=gen_random_uuid();
 signature text:='public.read_personal_data_review_page(text,uuid,uuid,integer)';
begin
 if current_setting('qa.prefix') not like 'qa-l13-private-%'
  or a=b or a=c or b=c
  or (select count(*) from auth.users u where u.id in (a,b,c)
   and u.email like current_setting('qa.prefix')||'-%@example.invalid')<>3 then
  raise exception 'Use three dedicated QA Auth accounts';
 end if;
 if has_function_privilege('anon',signature,'EXECUTE')
  or has_function_privilege('authenticated',signature,'EXECUTE')
  or not has_function_privilege('service_role',signature,'EXECUTE') then
  raise exception 'Unexpected function ACL';
 end if;
 if (select prosecdef from pg_proc where oid=signature::regprocedure) then
  raise exception 'Reader must remain security invoker';
 end if;
 insert into public.jobs(id,company_user_id,company_name,title,publication_status,status,is_active)
 values(j1,c,'QA private review','QA fixture','draft','paused',false),
 (j2,c,'QA private review','QA fixture','draft','paused',false),
 (j3,c,'QA private review','QA fixture','draft','paused',false);
 insert into private.application_disclosures(job_id,youth_user_id,revision,source_token,packet,matching_input)
 values(j1,a,1,'QA_OMITTED_TOKEN','{"text":"Eget underlag Åsa 🧑‍🍳"}','{"text":"Privat originaltext"}'),
 (j2,a,2,'QA_OMITTED_TOKEN','{"text":"Egen andra ansökan"}','{}'),
 (j3,b,1,'QA_OMITTED_TOKEN','{"text":"QA_FOREIGN"}','{}');
 insert into public.candidate_assessments(job_id,youth_user_id,company_user_id,job_profile_version,input_hash,result,criteria_snapshot)
 select j1,a,c,n,repeat('a',64),jsonb_build_object('policyVersion','old','text','Äldre egen bedömning Åsa 🧑‍🍳','fixtureVersion',n),'[]'::jsonb
 from generate_series(1,105) n;
 insert into public.candidate_assessments(job_id,youth_user_id,company_user_id,job_profile_version,input_hash,result,criteria_snapshot)
 values(j3,b,c,1,repeat('b',64),'{"text":"QA_FOREIGN"}','[]');
end;
$$;

set local role anon;
do $$begin
 begin
  perform public.read_personal_data_review_page('private.application_disclosures',current_setting('qa.youth_a')::uuid);
  raise exception 'Anonymous caller was allowed';
 exception when insufficient_privilege then null; end;
end;$$;
reset role;

set local role authenticated;
-- A forged role claim must not substitute for the real database role/ACL.
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$begin
 begin
  perform public.read_personal_data_review_page('public.candidate_assessments',current_setting('qa.youth_a')::uuid);
  raise exception 'Authenticated caller was allowed';
 exception when insufficient_privilege then null; end;
end;$$;
reset role;

set local role service_role;
do $$
declare a uuid:=current_setting('qa.youth_a')::uuid;
 b uuid:=current_setting('qa.youth_b')::uuid;
 c uuid:=current_setting('qa.company')::uuid;
 row_data jsonb; last_id uuid; total integer:=0; batch_count integer;
 seen_versions integer[]:='{}'; source_name text; bad_limit integer;
begin
 -- Small pages prove complete historical retrieval independently of normal RLS.
 loop
  batch_count:=0;
  for row_data in select * from public.read_personal_data_review_page('public.candidate_assessments',a,last_id,7) loop
   if (row_data->>'youth_user_id')::uuid<>a or row_data::text like '%QA_FOREIGN%'
    or row_data ? 'input_hash' or row_data ? 'source_token'
    or row_data->'result'->>'text'<>'Äldre egen bedömning Åsa 🧑‍🍳'
    or (last_id is not null and (row_data->>'id')::uuid<=last_id) then
    raise exception 'Unexpected assessment projection or scope';
   end if;
   last_id:=(row_data->>'id')::uuid;
   seen_versions:=array_append(seen_versions,(row_data->'result'->>'fixtureVersion')::integer);
   batch_count:=batch_count+1;total:=total+1;
  end loop;
  exit when batch_count=0;
  if total>105 then raise exception 'Pagination did not terminate'; end if;
 end loop;
 if total<>105 or (select count(distinct n) from unnest(seen_versions) n)<>105 then
  raise exception 'Historical rows lost';
 end if;
 if (select count(*) from public.read_personal_data_review_page('public.candidate_assessments',b))<>1 then
  raise exception 'Second youth scope is wrong';
 end if;
 total:=0;last_id:=null;
 loop
  batch_count:=0;
  for row_data in select * from public.read_personal_data_review_page('private.application_disclosures',a,last_id,1) loop
   if (row_data->>'youth_user_id')::uuid<>a or row_data::text like '%QA_FOREIGN%'
    or row_data ? 'source_token' or not row_data ? 'matching_input' or not row_data ? 'packet'
    or (last_id is not null and (row_data->>'job_id')::uuid<=last_id) then
    raise exception 'Unexpected disclosure projection or scope';
   end if;
   last_id:=(row_data->>'job_id')::uuid;batch_count:=batch_count+1;total:=total+1;
  end loop;
  exit when batch_count=0;
  if total>2 then raise exception 'Disclosure pagination did not terminate'; end if;
 end loop;
 if total<>2 then raise exception 'Own disclosures lost';end if;
 foreach source_name in array array['auth.users','public.profiles','private.application_disclosures;select 1',null] loop
  begin
   perform public.read_personal_data_review_page(source_name,a);
   raise exception 'Unknown source allowed';
  exception when invalid_parameter_value then null;end;
 end loop;
 foreach bad_limit in array array[0,-1,101,null] loop
  begin
   perform public.read_personal_data_review_page('public.candidate_assessments',a,null,bad_limit);
   raise exception 'Invalid page limit allowed';
  exception when invalid_parameter_value then null;end;
 end loop;
 begin
  perform public.read_personal_data_review_page('public.candidate_assessments',c);
  raise exception 'Company used as youth subject';
 exception when invalid_parameter_value then null;end;
 begin
  perform public.read_personal_data_review_page('public.candidate_assessments',null);
  raise exception 'Null subject allowed';
 exception when invalid_parameter_value then null;end;
end;
$$;
reset role;
select 'private review SQL checks passed' as result;

rollback;
