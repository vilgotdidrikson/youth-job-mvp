-- The dispatcher can succeed without invoking the cleanup worker.
create or replace function private.application_video_enabled()
returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from cron.job where jobname='mnw-video-cleanup' and active)
    and exists(select 1 from private.video_cleanup_config
               where singleton and enabled and btrim(endpoint)<>'');
$$;
