-- Profile-backed answers change the source generation. Check the lease afterwards.
do $$ declare definition text; begin
 select pg_get_functiondef('public.finish_application_analysis_job(uuid,uuid,bigint,uuid,text,jsonb,jsonb,jsonb)'::regprocedure) into definition;
 if position('perform private.sync_profile_followups(p_job,p_youth);' in definition)=0 or position('select * into task from' in definition)=0 then raise exception 'Worker definition unavailable'; end if;
 definition:=replace(definition,'perform private.sync_profile_followups(p_job,p_youth);','');
 definition:=replace(definition,'select * into task from','perform private.sync_profile_followups(p_job,p_youth);'||E'\n select * into task from');
 execute definition;
end; $$;
