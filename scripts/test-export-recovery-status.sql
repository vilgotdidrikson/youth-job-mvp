-- DevStaging only: all QA users/status rows roll back; no Storage writes.
begin;
select set_config('qa.recovery_subject',gen_random_uuid()::text,true);
select set_config('qa.recovery_other',gen_random_uuid()::text,true);
select set_config('qa.recovery_export',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role)
values(current_setting('qa.recovery_subject')::uuid,'qa-l13-recovery-a@example.invalid','{"role":"youth"}','{}','authenticated','authenticated'),
(current_setting('qa.recovery_other')::uuid,'qa-l13-recovery-b@example.invalid','{"role":"company"}','{}','authenticated','authenticated');
do $$begin
 if has_function_privilege('anon','public.latest_personal_data_export(uuid)','EXECUTE') or has_function_privilege('authenticated','public.latest_personal_data_export(uuid)','EXECUTE') or not has_function_privilege('service_role','public.latest_personal_data_export(uuid)','EXECUTE') then raise exception 'Unexpected latest RPC privileges'; end if;
 if (select prosecdef from pg_proc where oid='public.latest_personal_data_export(uuid)'::regprocedure) then raise exception 'Must remain invoker';end if;
end;$$;
set local role anon;
do $$begin
 begin perform public.latest_personal_data_export(current_setting('qa.recovery_subject')::uuid);raise exception 'Anonymous status allowed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$begin
 begin perform public.latest_personal_data_export(current_setting('qa.recovery_subject')::uuid);raise exception 'Forged role allowed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role service_role;
do $$declare a uuid:=current_setting('qa.recovery_subject')::uuid;b uuid:=current_setting('qa.recovery_other')::uuid;e uuid:=current_setting('qa.recovery_export')::uuid;j jsonb;begin
 if public.latest_personal_data_export(a)<>jsonb_build_object('status','none') or public.latest_personal_data_export(null)<>jsonb_build_object('status','none') then raise exception 'Absent state invalid';end if;
 perform public.begin_personal_data_export(a,e);
 j:=public.latest_personal_data_export(a);
 if j->>'status'<>'building' or j->>'id'<>e::text or j->>'subjectId'<>a::text or (select count(*) from jsonb_object_keys(j))<>4 then raise exception 'Building projection invalid';end if;
 if public.latest_personal_data_export(b)<>jsonb_build_object('status','none') then raise exception 'Foreign subject sees job';end if;
 if public.begin_personal_data_export(a,gen_random_uuid())->>'status'<>'busy' then raise exception 'Status read unlocked duplicate';end if;
 perform public.finish_personal_data_export(a,e,true,8,repeat('a',64));
 if public.latest_personal_data_export(a)->>'status'<>'ready' then raise exception 'Ready state missing';end if;
 if (select count(*) from private.personal_data_exports where subject_id=a)<>1 then raise exception 'Lookup created duplicate';end if;
 if (public.latest_personal_data_export(a)->>'expiresAt')::timestamptz<>statement_timestamp()+interval '1 hour' then raise exception 'Lookup extended expiry';end if;
 perform public.finish_personal_data_export(a,e,false);
 if public.latest_personal_data_export(a)<>jsonb_build_object('status','failed') then raise exception 'Failed state missing';end if;
end;$$;
reset role;
update private.personal_data_exports set created_at=statement_timestamp()-interval '2 hours',expires_at=statement_timestamp()-interval '1 hour' where id=current_setting('qa.recovery_export')::uuid;
set local role service_role;
do $$declare a uuid:=current_setting('qa.recovery_subject')::uuid;e uuid:=gen_random_uuid();begin
 if public.latest_personal_data_export(a)<>jsonb_build_object('status','expired') then raise exception 'Expired state missing';end if;
 perform public.begin_personal_data_export(a,e);
 if public.latest_personal_data_export(a)->>'id'<>e::text then raise exception 'New latest state shadowed by old failure';end if;
end;$$;
reset role;
-- Deletion never grants access just because a metadata row survives cleanup.
delete from auth.users where id=current_setting('qa.recovery_subject')::uuid;
set local role service_role;
do $$begin
 if public.latest_personal_data_export(current_setting('qa.recovery_subject')::uuid)<>jsonb_build_object('status','none') then raise exception 'Deleted subject status leaked';end if;
end;$$;
reset role;
rollback;
select 'PASS recovery RPC privileges, states, ownership, duplicate/expiry preservation and deleted subject; rollback' as result;
