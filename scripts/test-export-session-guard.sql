-- DevStaging ONLY. Temporary QA identities and session rows, no passwords,
-- refresh tokens, signed JWTs, Auth signup or persistent accounts. Always rollback.
begin;
select set_config('qa.export_user',gen_random_uuid()::text,true);
select set_config('qa.export_other',gen_random_uuid()::text,true);
select set_config('qa.export_session',gen_random_uuid()::text,true);
select set_config('qa.export_foreign_session',gen_random_uuid()::text,true);
select set_config('qa.export_expired_session',gen_random_uuid()::text,true);
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role)
values(current_setting('qa.export_user')::uuid,'qa-l13-session-a@example.invalid','{"role":"youth"}','{}','authenticated','authenticated'),
 (current_setting('qa.export_other')::uuid,'qa-l13-session-b@example.invalid','{"role":"company"}','{}','authenticated','authenticated');
insert into auth.sessions(id,user_id,not_after)
values(current_setting('qa.export_session')::uuid,current_setting('qa.export_user')::uuid,statement_timestamp()+interval '1 hour'),
 (current_setting('qa.export_foreign_session')::uuid,current_setting('qa.export_other')::uuid,null),
 (current_setting('qa.export_expired_session')::uuid,current_setting('qa.export_user')::uuid,statement_timestamp()-interval '1 second');
do $$
declare signature text;
begin
 foreach signature in array array['public.is_personal_data_session_active(uuid,uuid)','private.is_personal_data_session_active(uuid,uuid)'] loop
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE')
    or not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Unexpected function ACL'; end if;
  if (select proconfig from pg_proc where oid=signature::regprocedure) is distinct from array['search_path=""'] then raise exception 'Missing empty search path'; end if;
 end loop;
 if (select prosecdef from pg_proc where oid='public.is_personal_data_session_active(uuid,uuid)'::regprocedure)
  or not (select prosecdef from pg_proc where oid='private.is_personal_data_session_active(uuid,uuid)'::regprocedure) then raise exception 'Unexpected definer boundary'; end if;
 if has_table_privilege('service_role','auth.sessions','SELECT') then raise exception 'Broad Auth access must remain absent'; end if;
end;
$$;
set local role anon;
do $$begin
 begin
  perform public.is_personal_data_session_active(current_setting('qa.export_user')::uuid,current_setting('qa.export_session')::uuid);
  raise exception 'Anonymous wrapper caller allowed';
 exception when insufficient_privilege then null; end;
 begin
  perform private.is_personal_data_session_active(current_setting('qa.export_user')::uuid,current_setting('qa.export_session')::uuid);
  raise exception 'Anonymous private caller allowed';
 exception when insufficient_privilege then null; end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$begin
 begin
  perform public.is_personal_data_session_active(current_setting('qa.export_user')::uuid,current_setting('qa.export_session')::uuid);
  raise exception 'Forged role claim allowed wrapper';
 exception when insufficient_privilege then null; end;
 begin
  perform private.is_personal_data_session_active(current_setting('qa.export_user')::uuid,current_setting('qa.export_session')::uuid);
  raise exception 'Forged role claim allowed private function';
 exception when insufficient_privilege then null; end;
end;$$;
reset role;
set local role service_role;
do $$
declare u uuid:=current_setting('qa.export_user')::uuid;
 s uuid:=current_setting('qa.export_session')::uuid;
 other_user uuid:=current_setting('qa.export_other')::uuid;
 other_session uuid:=current_setting('qa.export_foreign_session')::uuid;
begin
 if public.is_personal_data_session_active(u,s) is distinct from true then raise exception 'Active own session denied'; end if;
 if public.is_personal_data_session_active(other_user,other_session) is distinct from true then raise exception 'Unbounded own session denied'; end if;
 if public.is_personal_data_session_active(u,other_session) is distinct from false then raise exception 'Foreign session allowed'; end if;
 if public.is_personal_data_session_active(other_user,s) is distinct from false then raise exception 'Foreign subject allowed'; end if;
 if public.is_personal_data_session_active(u,current_setting('qa.export_expired_session')::uuid) is distinct from false then raise exception 'Expired session allowed'; end if;
 if public.is_personal_data_session_active(u,gen_random_uuid()) is distinct from false then raise exception 'Missing session allowed'; end if;
 if public.is_personal_data_session_active(null,s) is distinct from false or public.is_personal_data_session_active(u,null) is distinct from false then raise exception 'Null input allowed'; end if;
 begin
  perform id from auth.sessions limit 1;
  raise exception 'Service role obtained raw Auth access';
 exception when insufficient_privilege then null; end;
end;$$;
reset role;
delete from auth.sessions where id=current_setting('qa.export_session')::uuid;
set local role service_role;
do $$begin
 if public.is_personal_data_session_active(current_setting('qa.export_user')::uuid,current_setting('qa.export_session')::uuid) is distinct from false then raise exception 'Removed session allowed'; end if;
end;$$;
reset role;
delete from auth.users where id=current_setting('qa.export_other')::uuid and email='qa-l13-session-b@example.invalid';
set local role service_role;
do $$begin
 if public.is_personal_data_session_active(current_setting('qa.export_other')::uuid,current_setting('qa.export_foreign_session')::uuid) is distinct from false then raise exception 'Deleted account session allowed'; end if;
end;$$;
reset role;
rollback;
