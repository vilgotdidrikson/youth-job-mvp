-- Allow the worker to close an expired final lease even when no other jobs are ready.
create or replace function private.dispatch_matching_worker()
returns void language plpgsql security definer set search_path = '' as $$ declare endpoint text; begin
 select c.endpoint into endpoint from private.matching_worker_config c where c.singleton and c.enabled;
 if endpoint is null or endpoint='' or not exists(select 1 from public.application_analysis_jobs where ((attempts<5 and status in ('pending','failed') and available_at<=now()) or (status='processing' and locked_at<now()-interval '2 minutes'))) then return; end if;
 perform net.http_post(url:=endpoint,headers:=jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||(select decrypted_secret from vault.decrypted_secrets where name='mnw_matching_worker_token' limit 1)),body:='{}',timeout_milliseconds:=60000);
end; $$;
revoke all on function private.dispatch_matching_worker() from public,anon,authenticated;
