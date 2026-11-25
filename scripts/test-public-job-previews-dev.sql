-- Run against DevStaging after the DA-18 migration. All fixtures are rolled back.
begin;
do $$
declare
  company uuid := gen_random_uuid();
  admin uuid := gen_random_uuid();
  youth uuid := gen_random_uuid();
  job uuid := gen_random_uuid();
  sample jsonb;
begin
  insert into auth.users(id,email,raw_user_meta_data) values
    (company,'qa-da18-'||company||'@example.invalid','{"role":"company"}'),
    (admin,'qa-da18-'||admin||'@example.invalid','{"role":"private"}'),
    (youth,'qa-da18-'||youth||'@example.invalid','{"role":"youth"}');
  insert into public.admin_users(user_id) values (admin);
  perform set_config('request.jwt.claim.sub',company::text,true);
  update public.company_profiles set organization_number='556016-0680', company_name='QA DA18' where user_id=company;
  insert into public.jobs(id,company_user_id,company_name,title,description,address,city,created_at)
    values(job,company,'QA DA18','QA Lager','QA privat testmarkör','QA Testvägen 1','Stockholm',now()+interval '1 day');

  set local role anon;
  if exists (select 1 from public.list_public_job_previews() where id=job) then raise exception 'Pending job is visible'; end if;
  begin perform 1 from public.jobs; raise exception 'Anonymous raw table read allowed'; exception when insufficient_privilege then null; end;
  begin perform public.get_job_direct_detail(job); raise exception 'Anonymous full detail RPC allowed'; exception when insufficient_privilege then null; end;
  set local role authenticated;
  perform set_config('request.jwt.claim.sub',admin::text,true);
  perform public.review_company_verification(company,'verified',null);

  set local role anon;
  select to_jsonb(p) into sample from public.list_public_job_previews() p where p.id=job;
  if sample is distinct from jsonb_build_object('id',job,'title','QA Lager','city','Stockholm') then raise exception 'Wrong preview or extra fields'; end if;
  if (select count(*) from public.list_public_job_previews()) > 6 then raise exception 'Preview cap exceeded'; end if;

  set local role authenticated;
  perform set_config('request.jwt.claim.sub',youth::text,true);
  if not exists (select 1 from public.jobs where id=job and description='QA privat testmarkör') then raise exception 'Authenticated detail stopped working'; end if;
  perform set_config('request.jwt.claim.sub',company::text,true);
  update public.jobs set status='paused' where id=job;
  set local role anon;
  if exists (select 1 from public.list_public_job_previews() where id=job) then raise exception 'Paused job is visible'; end if;
end $$;
reset role;
select 'PASS DA-18: role boundaries, approved preview, field allowlist, row cap and paused vacancy' as result;
rollback;
