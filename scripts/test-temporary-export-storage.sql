-- DevStaging ONLY. No actual files are created/deleted by SQL. The objects row
-- below is a rolled-back metadata fixture, NOT proof of physical Storage cleanup.
begin;
select set_config('qa.export_a',gen_random_uuid()::text,true);
select set_config('qa.export_b',gen_random_uuid()::text,true);
select set_config('qa.export_id',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role)
values(current_setting('qa.export_a')::uuid,'qa-l13-storage-a@example.invalid','{"role":"youth"}','{}','authenticated','authenticated'),
 (current_setting('qa.export_b')::uuid,'qa-l13-storage-b@example.invalid','{"role":"company"}','{}','authenticated','authenticated');
do $$declare signature text; begin
 foreach signature in array array['public.begin_personal_data_export(uuid,uuid)','public.finish_personal_data_export(uuid,uuid,boolean,bigint,text)','public.read_personal_data_export(uuid,uuid)','public.claim_personal_data_export_cleanup(integer)','public.finish_personal_data_export_cleanup(uuid,uuid,boolean)','public.reconcile_personal_data_export_orphans(integer)'] loop
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE') or not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Unexpected RPC privilege'; end if;
  if (select prosecdef from pg_proc where oid=signature::regprocedure) then raise exception 'RPC must remain invoker'; end if;
 end loop;
 if has_table_privilege('anon','private.personal_data_exports','SELECT') or has_table_privilege('authenticated','private.personal_data_exports','SELECT') then raise exception 'Export table exposed'; end if;
 if not exists(select 1 from storage.buckets where id='personal-data-exports' and not public and file_size_limit=67108864 and allowed_mime_types=array['application/zip']) then raise exception 'Bucket not private/bounded'; end if;
end;$$;
set local role anon;
do $$begin
 begin perform public.begin_personal_data_export(current_setting('qa.export_a')::uuid,current_setting('qa.export_id')::uuid);raise exception 'Anonymous export allowed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.export_a'),'role','service_role')::text,true);
do $$begin
 begin perform public.read_personal_data_export(current_setting('qa.export_a')::uuid,current_setting('qa.export_id')::uuid);raise exception 'Forged role claim allowed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role service_role;
do $$declare a uuid:=current_setting('qa.export_a')::uuid;b uuid:=current_setting('qa.export_b')::uuid;e uuid:=current_setting('qa.export_id')::uuid;j jsonb;begin
 j:=public.begin_personal_data_export(a,e);
 if j->>'status'<>'building' or j->>'path'<>a::text||'/'||e::text||'.zip' or (j->>'expiresAt')::timestamptz<>statement_timestamp()+interval '1 hour' then raise exception 'Invalid handle/expiry';end if;
 if public.begin_personal_data_export(a,e) is distinct from j then raise exception 'Reservation not idempotent';end if;
 if public.begin_personal_data_export(a,gen_random_uuid())->>'status'<>'busy' then raise exception 'Duplicate active export allowed';end if;
 if public.read_personal_data_export(a,e)->>'status'<>'unavailable' then raise exception 'Building export readable';end if;
 if public.finish_personal_data_export(b,e,true,8,repeat('a',64)) then raise exception 'Foreign completion allowed';end if;
 begin perform public.finish_personal_data_export(a,e,true,0,repeat('a',64));raise exception 'Zero size allowed';exception when invalid_parameter_value then null;end;
 if not public.finish_personal_data_export(a,e,true,8,repeat('a',64)) then raise exception 'Valid completion failed';end if;
 if public.finish_personal_data_export(a,e,true,8,repeat('a',64)) then raise exception 'Completed export can be overwritten';end if;
 if public.read_personal_data_export(a,e)->>'status'<>'ready' or public.read_personal_data_export(b,e)->>'status'<>'unavailable' then raise exception 'Ready ownership failure';end if;
 if exists(select 1 from public.claim_personal_data_export_cleanup(20)) then raise exception 'Fresh ready export claimed';end if;
end;$$;
reset role;
-- Expire the fixture while preserving the exact one-hour lifetime constraint.
update private.personal_data_exports set created_at=statement_timestamp()-interval '2 hours',expires_at=statement_timestamp()-interval '1 hour' where id=current_setting('qa.export_id')::uuid;
-- Metadata-only orphan fixture. This row has NO backing file in Storage.
insert into storage.objects(bucket_id,name,created_at) values('personal-data-exports',current_setting('qa.export_a')||'/'||gen_random_uuid()::text||'.zip',statement_timestamp()-interval '1 hour');
set local role authenticated;
select set_config('request.jwt.claims',jsonb_build_object('sub',current_setting('qa.export_a'),'role','authenticated')::text,true);
do $$begin
 if exists(select 1 from storage.objects where bucket_id='personal-data-exports') then raise exception 'Owner can read private package objects';end if;
 begin insert into storage.objects(bucket_id,name) values('personal-data-exports',current_setting('qa.export_a')||'/forbidden.zip');raise exception 'Owner can write private package';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role service_role;
do $$declare a uuid:=current_setting('qa.export_a')::uuid;e uuid:=current_setting('qa.export_id')::uuid;next_id uuid:=gen_random_uuid();leases jsonb[];job jsonb;begin
 if public.read_personal_data_export(a,e)->>'status'<>'unavailable' then raise exception 'Expired export readable';end if;
 if public.begin_personal_data_export(a,next_id)->>'status'<>'building' then raise exception 'Expired export blocks retry';end if;
 if not public.finish_personal_data_export(a,next_id,false) then raise exception 'Failure not recorded';end if;
 if public.reconcile_personal_data_export_orphans(20)<>1 or public.reconcile_personal_data_export_orphans(20)<>0 then raise exception 'Orphan reconciliation not idempotent';end if;
 select array_agg(value) into leases from public.claim_personal_data_export_cleanup(20) value;
 if cardinality(leases)<>3 then raise exception 'Expected expired, failed and orphan cleanup';end if;
 if exists(select 1 from public.claim_personal_data_export_cleanup(20)) then raise exception 'Active cleanup lease claimed twice';end if;
 foreach job in array leases loop
  if public.finish_personal_data_export_cleanup((job->>'id')::uuid,gen_random_uuid(),true) then raise exception 'Wrong cleanup lock accepted';end if;
  if not public.finish_personal_data_export_cleanup((job->>'id')::uuid,(job->>'lockToken')::uuid,false) then raise exception 'Retry not recorded';end if;
  if public.finish_personal_data_export_cleanup((job->>'id')::uuid,(job->>'lockToken')::uuid,true) then raise exception 'Consumed lease accepted';end if;
 end loop;
 if exists(select 1 from public.claim_personal_data_export_cleanup(20)) then raise exception 'Retry delay ignored';end if;
 update private.personal_data_exports set retry_at=statement_timestamp()-interval '1 second' where subject_id=a;
 for job in select * from public.claim_personal_data_export_cleanup(20) loop
  if not public.finish_personal_data_export_cleanup((job->>'id')::uuid,(job->>'lockToken')::uuid,true) then raise exception 'Successful cleanup not finished';end if;
 end loop;
 if exists(select 1 from private.personal_data_exports where subject_id=a) then raise exception 'Finished cleanup metadata retained';end if;
 -- The still-present metadata fixture simulates a very late remote upload.
 if public.reconcile_personal_data_export_orphans(20)<>1 then raise exception 'Late orphan escaped reconciliation';end if;
 begin perform public.claim_personal_data_export_cleanup(21);raise exception 'Oversize cleanup batch allowed';exception when invalid_parameter_value then null;end;
end;$$;
reset role;
set local role service_role;
do $$declare e uuid:=gen_random_uuid();b uuid:=current_setting('qa.export_b')::uuid;begin
 perform public.begin_personal_data_export(b,e);
 perform public.finish_personal_data_export(b,e,true,8,repeat('b',64));
 perform set_config('qa.deleted_export',e::text,true);
end;$$;
reset role;
delete from auth.users where id=current_setting('qa.export_b')::uuid and email='qa-l13-storage-b@example.invalid';
set local role service_role;
do $$declare job jsonb;found_deleted boolean:=false;begin
 if public.read_personal_data_export(current_setting('qa.export_b')::uuid,current_setting('qa.deleted_export')::uuid)->>'status'<>'unavailable' then raise exception 'Deleted account can read package';end if;
 if not exists(select 1 from private.personal_data_exports where id=current_setting('qa.deleted_export')::uuid) then raise exception 'Account deletion lost cleanup metadata';end if;
 for job in select * from public.claim_personal_data_export_cleanup(20) loop
  if job->>'id'=current_setting('qa.deleted_export') then found_deleted:=true;end if;
 end loop;
 if not found_deleted then raise exception 'Deleted account not eligible for cleanup';end if;
end;$$;
reset role;
rollback;
select 'PASS temporary export database lifecycle and role checks; all QA fixtures rolled back' as result;
