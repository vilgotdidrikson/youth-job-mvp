-- Provision independently of user JWTs. Never return/log the generated value.
do $$begin
 if not exists(select 1 from vault.secrets where name='mnw_personal_data_export_cleanup_token') then
  perform vault.create_secret(encode(extensions.gen_random_bytes(32),'hex'),'mnw_personal_data_export_cleanup_token','Independent export cleanup worker credential');
 end if;
end;$$;

create function private.validate_personal_data_export_cleanup_token(p_token text)
returns boolean language plpgsql stable security definer set search_path='' as $$
begin
 if current_setting('role',true) is distinct from 'service_role' then raise exception using errcode='42501',message='Worker validation is restricted';end if;
 return coalesce(p_token ~ '^[a-f0-9]{64}$' and p_token=(select decrypted_secret from vault.decrypted_secrets where name='mnw_personal_data_export_cleanup_token' limit 1),false);
end;$$;
revoke all on function private.validate_personal_data_export_cleanup_token(text) from public,anon,authenticated;
grant execute on function private.validate_personal_data_export_cleanup_token(text) to service_role;

create function public.validate_personal_data_export_cleanup_token(p_token text)
returns boolean language plpgsql stable security invoker set search_path='' as $$
begin
 if current_user<>'service_role' then raise exception using errcode='42501',message='Worker validation is restricted';end if;
 return private.validate_personal_data_export_cleanup_token(p_token);
end;$$;
revoke all on function public.validate_personal_data_export_cleanup_token(text) from public,anon,authenticated;
grant execute on function public.validate_personal_data_export_cleanup_token(text) to service_role;

-- No caller-supplied URL/token. Configure the project-specific URL separately in
-- Vault; a new environment never inherits a hardcoded DevStaging destination.
create function private.dispatch_personal_data_export_cleanup()
returns bigint language plpgsql security definer set search_path='' as $$
declare endpoint text; credential text;
begin
 select decrypted_secret into endpoint from vault.decrypted_secrets where name='mnw_personal_data_export_cleanup_url' limit 1;
 if endpoint is null or endpoint='' then return null;end if;
 if endpoint !~ '^https://[a-z]{20}\.supabase\.co/functions/v1/personal-data-export-cleanup$' then raise exception 'Invalid cleanup endpoint';end if;
 select decrypted_secret into credential from vault.decrypted_secrets where name='mnw_personal_data_export_cleanup_token' limit 1;
 if credential is null or credential !~ '^[a-f0-9]{64}$' then raise exception 'Cleanup credential unavailable';end if;
 return net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||credential),body:='{}'::jsonb,timeout_milliseconds:=55000);
end;$$;
revoke all on function private.dispatch_personal_data_export_cleanup() from public,anon,authenticated,service_role;

-- Atomic creation + deactivation. Activation requires separately verified
-- storage/worker flow, operational monitoring, and a writer using this storage.
do $$declare job_id bigint;begin
 job_id:=cron.schedule('mnw-personal-data-export-cleanup','*/5 * * * *','select private.dispatch_personal_data_export_cleanup()');
 perform cron.alter_job(job_id,active:=false);
end;$$;
