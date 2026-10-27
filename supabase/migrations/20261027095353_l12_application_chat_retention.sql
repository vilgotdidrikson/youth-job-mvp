-- L12: application/chat lifecycle. No existing data is purged by this migration.
-- Enforcement and cron remain OFF until policy, legacy clocks and launch checks
-- are reviewed. Current profile/CV files, matches/employment and report snapshots
-- are separate categories and are never cascaded away by this worker.
create table private.data_retention_config (
 singleton boolean primary key default true check(singleton),
 applications_enabled boolean not null default false,
 chats_enabled boolean not null default false,
 policy_reference text,
 policy_reviewed_at timestamptz,
 legacy_reviewed_at timestamptz,
 check (not (applications_enabled or chats_enabled) or
   (nullif(btrim(policy_reference),'') is not null and policy_reviewed_at is not null and legacy_reviewed_at is not null))
);
insert into private.data_retention_config(singleton) values(true);
alter table private.data_retention_config enable row level security;
revoke all on private.data_retention_config from public,anon,authenticated;

create table private.application_retention (
 job_id uuid not null references public.jobs(id) on delete cascade,
 youth_user_id uuid not null references auth.users(id) on delete cascade,
 closed_at timestamptz not null,
 delete_after timestamptz not null,
 reason text not null check(reason in('withdrawn','rejected','cancelled','job_closed','hired')),
 legacy_estimate boolean not null default false,
 purged_at timestamptz,
 primary key(job_id,youth_user_id),
 check(delete_after>=closed_at)
);
create index application_retention_due on private.application_retention(delete_after) where purged_at is null;
alter table private.application_retention enable row level security;
revoke all on private.application_retention from public,anon,authenticated;

create table private.conversation_retention (
 conversation_id uuid primary key references public.conversations(id) on delete cascade,
 last_activity_at timestamptz not null,
 read_only_at timestamptz not null,
 delete_after timestamptz not null,
 legacy_estimate boolean not null default false,
 purged_at timestamptz,
 check(read_only_at>=last_activity_at and delete_after>=read_only_at)
);
create index conversation_retention_due on private.conversation_retention(delete_after) where purged_at is null;
alter table private.conversation_retention enable row level security;
revoke all on private.conversation_retention from public,anon,authenticated;

create table private.data_retention_runs (
 id uuid primary key default gen_random_uuid(),
 finished_at timestamptz not null default statement_timestamp(),
 applications integer not null,
 conversations integer not null,
 failures integer not null,
 error_codes text[] not null default '{}'
);
alter table private.data_retention_runs enable row level security;
revoke all on private.data_retention_runs from public,anon,authenticated;

create function private.application_content_available(p_job uuid,p_youth uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.application_retention r
  where r.job_id=p_job and r.youth_user_id=p_youth and
   (r.purged_at is not null or (coalesce((select applications_enabled from private.data_retention_config where singleton),false) and r.delete_after<=statement_timestamp())));
$$;
create function private.chat_content_available(p_conversation uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.conversation_retention r
  where r.conversation_id=p_conversation and
   (r.purged_at is not null or (coalesce((select chats_enabled from private.data_retention_config where singleton),false) and r.delete_after<=statement_timestamp())));
$$;
create function private.chat_writable(p_conversation uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select not exists(select 1 from private.conversation_retention r
  where r.conversation_id=p_conversation and
   (r.purged_at is not null or (coalesce((select chats_enabled from private.data_retention_config where singleton),false) and r.read_only_at<=statement_timestamp())));
$$;
revoke all on function private.application_content_available(uuid,uuid),private.chat_content_available(uuid),private.chat_writable(uuid) from public,anon;
grant execute on function private.application_content_available(uuid,uuid),private.chat_content_available(uuid),private.chat_writable(uuid) to authenticated,service_role;

-- One application period ends on an explicit terminal action, never on pause,
-- profile edits, AI work or notification delivery. A reopened job clears only
-- its own unpurged closure; individual withdrawal/rejection/hire stays closed.
create function private.sync_application_retention(p_job uuid,p_youth uuid,p_legacy boolean default false)
returns void language plpgsql security definer set search_path='' as $$
declare a public.application_completions; m public.matches; ending text; stamp timestamptz:=statement_timestamp(); recorded timestamptz;
begin
 perform pg_advisory_xact_lock(hashtextextended(p_youth::text||':'||p_job::text,0));
 select * into a from public.application_completions where job_id=p_job and youth_user_id=p_youth;
 select * into m from public.matches where job_id=p_job and youth_user_id=p_youth;
 if m.hire_completed_at is not null then ending:='hired'; recorded:=m.hire_completed_at;
 elsif a.status='withdrawn' then ending:='withdrawn'; recorded:=a.withdrawn_at;
 elsif m.status in('rejected','cancelled') then ending:=m.status;
 elsif exists(select 1 from public.jobs where id=p_job and status='closed') then
  ending:='job_closed'; select recorded_at into recorded from public.recruitment_outcomes where job_id=p_job;
 end if;
 if ending is null then
  delete from private.application_retention where job_id=p_job and youth_user_id=p_youth and purged_at is null
   and (a.job_id is not null or m.id is not null)
   and (delete_after>statement_timestamp() or not coalesce((select applications_enabled from private.data_retention_config where singleton),false));
  return;
 end if;
 -- Legacy source dates are estimates until explicitly reviewed before enablement.
 if p_legacy then stamp:=least(coalesce(recorded,stamp),stamp); end if;
 insert into private.application_retention(job_id,youth_user_id,closed_at,delete_after,reason,legacy_estimate)
 values(p_job,p_youth,stamp,stamp+interval '6 months',ending,p_legacy)
 on conflict(job_id,youth_user_id) do nothing;
end; $$;
revoke all on function private.sync_application_retention(uuid,uuid,boolean) from public,anon,authenticated;

create function private.track_application_retention()
returns trigger language plpgsql security definer set search_path='' as $$
declare pair record;
begin
 if tg_table_name='jobs' then
  if new.status is distinct from old.status then
   for pair in select youth_user_id from public.application_completions where job_id=new.id
    union select youth_user_id from public.matches where job_id=new.id
   loop perform private.sync_application_retention(new.id,pair.youth_user_id); end loop;
  end if;
 else perform private.sync_application_retention(new.job_id,new.youth_user_id); end if;
 return new;
end; $$;
revoke all on function private.track_application_retention() from public,anon,authenticated;
create trigger l12_application_clock after insert or update of status,withdrawn_at on public.application_completions for each row execute function private.track_application_retention();
create trigger l12_match_clock after insert or update of status,hire_completed_at on public.matches for each row execute function private.track_application_retention();
create trigger l12_job_clock after update of status on public.jobs for each row execute function private.track_application_retention();

create function private.guard_retained_application_write()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.youth_user_id::text||':'||new.job_id::text,0));
 if not private.application_content_available(new.job_id,new.youth_user_id) then
  raise exception 'Ansökans underlag har nått sin lagringstid och kan inte ändras eller återskapas.' using errcode='PT409';
 end if;
 return new;
end; $$;
revoke all on function private.guard_retained_application_write() from public,anon,authenticated;
create trigger l12_completion_write before insert or update on public.application_completions for each row execute function private.guard_retained_application_write();
create trigger l12_disclosure_write before insert or update on private.application_disclosures for each row execute function private.guard_retained_application_write();
create trigger l12_assessment_write before insert or update on public.candidate_assessments for each row execute function private.guard_retained_application_write();
create trigger l12_followup_write before insert or update on public.application_followups for each row execute function private.guard_retained_application_write();
create trigger l12_workplace_write before insert or update on public.application_workplace_preferences for each row execute function private.guard_retained_application_write();
create trigger l12_draft_write before insert or update on public.youth_application_drafts for each row execute function private.guard_retained_application_write();

-- Restrictive policies preserve every existing ownership/blocking predicate.
create policy "retained completion only" on public.application_completions as restrictive for select to authenticated using(private.application_content_available(job_id,youth_user_id));
create policy "retained followups only" on public.application_followups as restrictive for select to authenticated using(private.application_content_available(job_id,youth_user_id));
create policy "retained assessments only" on public.candidate_assessments as restrictive for select to authenticated using(private.application_content_available(job_id,youth_user_id));
create policy "retained workplace only" on public.application_workplace_preferences as restrictive for select to authenticated using(private.application_content_available(job_id,youth_user_id));

create function private.initialize_chat_retention()
returns trigger language plpgsql security definer set search_path='' as $$
declare stamp timestamptz:=statement_timestamp();
begin
 insert into private.conversation_retention(conversation_id,last_activity_at,read_only_at,delete_after)
 values(new.id,stamp,stamp+interval '6 months',stamp+interval '12 months');
 return new;
end; $$;
create function private.track_chat_activity()
returns trigger language plpgsql security definer set search_path='' as $$
declare r private.conversation_retention; stamp timestamptz;
begin
 select * into r from private.conversation_retention where conversation_id=new.conversation_id for update;
 if not private.chat_writable(new.conversation_id) then
  raise exception 'Chatten är skrivskyddad efter sex månaders inaktivitet.' using errcode='PT409';
 end if;
 -- Existing message RLS still verifies the sender/participants. Failed inserts
 -- roll this clock back too. Service/system work must not count as user activity.
 if auth.uid() is not null and auth.uid()=new.sender_user_id then
  stamp:=greatest(r.last_activity_at,statement_timestamp());
  update private.conversation_retention set last_activity_at=stamp,read_only_at=stamp+interval '6 months',delete_after=stamp+interval '12 months'
   where conversation_id=new.conversation_id;
 end if;
 return new;
end; $$;
revoke all on function private.initialize_chat_retention(),private.track_chat_activity() from public,anon,authenticated;
create trigger l12_new_chat after insert on public.conversations for each row execute function private.initialize_chat_retention();
create trigger l12_message_clock before insert or update on public.messages for each row execute function private.track_chat_activity();
create policy "retained chat messages only" on public.messages as restrictive for select to authenticated using(private.chat_content_available(conversation_id));

-- Safe inventory backfill: no enforcement and no deletion. Pre-existing client
-- timestamps are not asserted to be trustworthy; global legacy review is required.
insert into private.conversation_retention(conversation_id,last_activity_at,read_only_at,delete_after,legacy_estimate)
 select c.id,s.stamp,s.stamp+interval '6 months',s.stamp+interval '12 months',true
 from public.conversations c cross join lateral (
  select least(statement_timestamp(),greatest(c.created_at,c.last_message_at,(select max(m.created_at) from public.messages m where m.conversation_id=c.id))) stamp
 ) s on conflict do nothing;
do $$ declare pair record; begin
 for pair in select job_id,youth_user_id from public.application_completions
  union select job_id,youth_user_id from public.matches where job_id is not null
 loop perform private.sync_application_retention(pair.job_id,pair.youth_user_id,true); end loop;
end $$;

-- Body deletion is atomic per item. SKIP LOCKED + the existing youth/job lock
-- make overlapping runs/retries safe. No original CV/media or parent match is
-- deleted: employment snapshots, report evidence and shared files survive.
create function private.process_data_retention(p_limit integer default 25,p_only_job_id uuid default null,p_only_conversation_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg private.data_retention_config; r record; app_count int:=0; chat_count int:=0; failures int:=0; failure_codes text[]:='{}';
begin
 select * into cfg from private.data_retention_config where singleton;
 if not found or (not cfg.applications_enabled and not cfg.chats_enabled) then return jsonb_build_object('applications',0,'conversations',0,'failures',0,'enabled',false); end if;
 if cfg.applications_enabled and (p_only_conversation_id is null or p_only_job_id is not null) then
  for r in select * from private.application_retention where purged_at is null and delete_after<=statement_timestamp() and (p_only_job_id is null or job_id=p_only_job_id)
   order by delete_after,job_id,youth_user_id limit greatest(1,least(p_limit,100)) for update skip locked
  loop
   begin
    -- A concurrent close/reopen owns this job row or the shared application lock.
    perform 1 from public.jobs where id=r.job_id for share skip locked;
    if not found or not pg_try_advisory_xact_lock(hashtextextended(r.youth_user_id::text||':'||r.job_id::text,0)) then continue; end if;
    perform private.sync_application_retention(r.job_id,r.youth_user_id);
    if not exists(select 1 from private.application_retention where job_id=r.job_id and youth_user_id=r.youth_user_id and purged_at is null and delete_after<=statement_timestamp()) then continue; end if;
    delete from public.application_analysis_jobs where job_id=r.job_id and youth_user_id=r.youth_user_id;
    delete from public.application_followups where job_id=r.job_id and youth_user_id=r.youth_user_id;
    delete from public.candidate_assessments where job_id=r.job_id and youth_user_id=r.youth_user_id;
    delete from public.application_workplace_preferences where job_id=r.job_id and youth_user_id=r.youth_user_id;
    delete from private.application_disclosures where job_id=r.job_id and youth_user_id=r.youth_user_id;
    delete from public.youth_application_drafts where job_id=r.job_id and youth_user_id=r.youth_user_id;
    delete from public.application_completions where job_id=r.job_id and youth_user_id=r.youth_user_id;
    update private.application_retention set purged_at=statement_timestamp() where job_id=r.job_id and youth_user_id=r.youth_user_id;
    app_count:=app_count+1;
   exception when others then failures:=failures+1; failure_codes:=array_append(failure_codes,sqlstate);
   end;
  end loop;
 end if;
 if cfg.chats_enabled and (p_only_job_id is null or p_only_conversation_id is not null) then
  for r in select * from private.conversation_retention where purged_at is null and delete_after<=statement_timestamp() and (p_only_conversation_id is null or conversation_id=p_only_conversation_id)
   order by delete_after,conversation_id limit greatest(1,least(p_limit,100)) for update skip locked
  loop
   begin
    delete from public.messages where conversation_id=r.conversation_id;
    delete from public.notifications n using public.conversations c where c.id=r.conversation_id and n.match_id=c.match_id and n.type='message';
    update private.conversation_retention set purged_at=statement_timestamp() where conversation_id=r.conversation_id;
    chat_count:=chat_count+1;
   exception when others then failures:=failures+1; failure_codes:=array_append(failure_codes,sqlstate);
   end;
  end loop;
 end if;
 insert into private.data_retention_runs(applications,conversations,failures,error_codes) values(app_count,chat_count,failures,failure_codes);
 delete from private.data_retention_runs where finished_at<statement_timestamp()-interval '90 days';
 return jsonb_build_object('applications',app_count,'conversations',chat_count,'failures',failures,'error_codes',to_jsonb(failure_codes),'enabled',true);
end; $$;
revoke all on function private.process_data_retention(integer,uuid,uuid) from public,anon,authenticated;
grant execute on function private.process_data_retention(integer,uuid,uuid) to service_role;

create function public.get_my_application_retention()
returns table(job_id uuid,youth_user_id uuid,job_title text,company_name text,closed_at timestamptz,delete_after timestamptz,purged_at timestamptz,reason text,enforced boolean,expired boolean,server_now timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null then raise exception 'Authentication required' using errcode='42501'; end if;
 return query select r.job_id,r.youth_user_id,j.title,j.company_name,r.closed_at,r.delete_after,r.purged_at,r.reason,c.applications_enabled,
  r.purged_at is not null or (c.applications_enabled and r.delete_after<=statement_timestamp()),statement_timestamp()
 from private.application_retention r join public.jobs j on j.id=r.job_id cross join private.data_retention_config c
 where r.youth_user_id=auth.uid() or (j.company_user_id=auth.uid() and public.is_verified_company());
end; $$;
revoke all on function public.get_my_application_retention() from public,anon;
grant execute on function public.get_my_application_retention() to authenticated;

create function public.get_conversation_retention(p_conversation_id uuid)
returns table(conversation_id uuid,last_activity_at timestamptz,read_only_at timestamptz,delete_after timestamptz,purged_at timestamptz,enforced boolean,read_only boolean,expired boolean,server_now timestamptz)
language plpgsql security definer set search_path='' as $$
begin
 if auth.uid() is null or not exists(select 1 from public.conversations c where c.id=p_conversation_id and auth.uid() in(c.youth_user_id,c.company_user_id)) then
  raise exception 'Conversation access required' using errcode='42501'; end if;
 return query select r.conversation_id,r.last_activity_at,r.read_only_at,r.delete_after,r.purged_at,c.chats_enabled,
  r.purged_at is not null or (c.chats_enabled and r.read_only_at<=statement_timestamp()),
  r.purged_at is not null or (c.chats_enabled and r.delete_after<=statement_timestamp()),statement_timestamp()
 from private.conversation_retention r cross join private.data_retention_config c where r.conversation_id=p_conversation_id;
end; $$;
revoke all on function public.get_conversation_retention(uuid) from public,anon;
grant execute on function public.get_conversation_retention(uuid) to authenticated;

-- Keep the existing authorization and disclosed-input contracts; add expiry
-- at their shared source so all RPC, CV-signing and assessment paths agree.
CREATE OR REPLACE FUNCTION private.disclosure_company_access(p_job uuid, p_youth uuid, p_company uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select private.application_content_available(p_job,p_youth) and p_company is not null and public.is_verified_company(p_company) and exists(select 1 from public.jobs j join public.swipe_actions s on s.job_id=j.id where j.id=p_job and j.company_user_id=p_company and s.youth_user_id=p_youth and s.decision='interested' and not public.users_are_blocked(p_company,p_youth));
$function$;

CREATE OR REPLACE FUNCTION private.application_analysis_eligible(p_job uuid, p_youth uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select private.application_content_available(p_job,p_youth) and exists(select 1 from public.jobs j join public.company_profiles cp on cp.user_id=j.company_user_id
 join public.application_completions a on a.job_id=j.id and a.youth_user_id=p_youth and a.status='submitted'
 join public.swipe_actions s on s.job_id=j.id and s.youth_user_id=p_youth and s.decision='interested'
 join public.job_match_profiles m on m.job_id=j.id and m.status='approved'
 where j.id=p_job and j.status='active' and j.is_active and j.publication_status='published' and cp.verification_status='verified'
 and not public.users_are_blocked(j.company_user_id,p_youth)
 and not exists(select 1 from public.company_interest_actions d where d.job_id=j.id and d.youth_user_id=p_youth and d.decision='skip')
 and not exists(select 1 from public.matches mt where mt.job_id=j.id and mt.youth_user_id=p_youth and mt.status in ('hired','rejected','cancelled')));
$function$;

CREATE OR REPLACE FUNCTION private.shared_application_packet(p_job uuid, p_youth uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select d.packet||jsonb_build_object('revision',d.revision,'shared_at',d.updated_at,
  'answers',coalesce((select a.answers from public.application_completions a where a.job_id=p_job and a.youth_user_id=p_youth and a.status='submitted'),'{}'),
  'followup_answers',coalesce((select jsonb_agg(jsonb_build_object('question',f.question,'answer',f.answer) order by f.created_at,f.id) from public.application_followups f where f.job_id=p_job and f.youth_user_id=p_youth and f.status='answered'),'[]'))
 from private.application_disclosures d where d.job_id=p_job and d.youth_user_id=p_youth and private.application_content_available(p_job,p_youth);
$function$;

CREATE OR REPLACE FUNCTION private.application_matching_input(p_job uuid, p_youth uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select d.matching_input||jsonb_build_object('job_context',(select jsonb_build_object('title',j.title,'description',j.description,'requirements',j.requirements,'employment_type',j.employment_type,'schedule',j.schedule,'workplace_cities',coalesce((select jsonb_agg(w->>'city') from jsonb_array_elements(j.workplaces) w),jsonb_build_array(j.city))) from public.jobs j where j.id=p_job),'disclosure_revision',d.revision,'source_updated_at',d.updated_at,'answers',p->'answers','followup_answers',p->'followup_answers')
 from private.application_disclosures d cross join lateral private.shared_application_packet(p_job,p_youth) p where d.job_id=p_job and d.youth_user_id=p_youth and private.application_content_available(p_job,p_youth);
$function$;

CREATE OR REPLACE FUNCTION private.get_application_disclosure(p_job_id uuid, p_youth_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if not private.application_content_available(p_job_id,p_youth_user_id) then raise exception 'Application access required' using errcode='42501'; end if;
 if auth.uid() is null or not (auth.uid()=p_youth_user_id or private.disclosure_company_access(p_job_id,p_youth_user_id,auth.uid())) then raise exception 'Application access required' using errcode='42501'; end if;
 return private.shared_application_packet(p_job_id,p_youth_user_id);
end $function$;

CREATE OR REPLACE FUNCTION private.can_access_application_followups(p_job_id uuid, p_youth_user_id uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select private.application_content_available(p_job_id,p_youth_user_id) and auth.uid() is not null and exists(
    select 1 from public.jobs j join public.profiles p on p.id=auth.uid()
    where j.id=p_job_id and not public.users_are_blocked(j.company_user_id,p_youth_user_id)
    and ((p.role='youth' and p_youth_user_id=auth.uid()) or
      (p.role='company' and j.company_user_id=auth.uid() and public.is_verified_company()))
    and (exists(select 1 from public.application_completions a where a.job_id=j.id and a.youth_user_id=p_youth_user_id and a.status='submitted')
      or exists(select 1 from public.swipe_actions s where s.job_id=j.id and s.youth_user_id=p_youth_user_id and s.decision='interested'))
  );
$function$;

-- Installed but inactive. Enabling requires both policy/legacy review and a
-- separate deployment decision; no external request or deletion runs here.
do $$ declare job bigint; begin
 if not exists(select 1 from cron.job where jobname='mnw-data-retention') then
  job:=cron.schedule('mnw-data-retention','17 * * * *','select private.process_data_retention(25);');
  perform cron.alter_job(job,active:=false);
 end if;
end $$;

