-- DevStaging, no keys returned and no HTTP dispatched by this rollback test.
begin;
do $$declare signature text;begin
 foreach signature in array array['public.validate_personal_data_export_cleanup_token(text)','private.validate_personal_data_export_cleanup_token(text)'] loop
  if has_function_privilege('anon',signature,'EXECUTE') or has_function_privilege('authenticated',signature,'EXECUTE') or not has_function_privilege('service_role',signature,'EXECUTE') then raise exception 'Unexpected validator ACL';end if;
 end loop;
 if has_function_privilege('anon','private.dispatch_personal_data_export_cleanup()','EXECUTE') or has_function_privilege('authenticated','private.dispatch_personal_data_export_cleanup()','EXECUTE') or has_function_privilege('service_role','private.dispatch_personal_data_export_cleanup()','EXECUTE') then raise exception 'Dispatcher exposed';end if;
 if not exists(select 1 from cron.job where jobname='mnw-personal-data-export-cleanup' and not active and schedule='*/5 * * * *') then raise exception 'Cron not configured inactive';end if;
end;$$;
set local role anon;
do $$begin
 begin perform public.validate_personal_data_export_cleanup_token(repeat('a',64));raise exception 'Anonymous validator allowed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims','{"role":"service_role"}',true);
do $$begin
 begin perform public.validate_personal_data_export_cleanup_token(repeat('a',64));raise exception 'Forged role validator allowed';exception when insufficient_privilege then null;end;
end;$$;
reset role;
set local role service_role;
do $$begin
 if public.validate_personal_data_export_cleanup_token(null) or public.validate_personal_data_export_cleanup_token('user.jwt.token') or public.validate_personal_data_export_cleanup_token(repeat('a',64)) then raise exception 'Invalid worker credential accepted';end if;
 begin perform private.dispatch_personal_data_export_cleanup();raise exception 'Service can dispatch';exception when insufficient_privilege then null;end;
end;$$;
reset role;
rollback;
select 'PASS cleanup validator ACL and disabled cron; no secret values returned' as result;
