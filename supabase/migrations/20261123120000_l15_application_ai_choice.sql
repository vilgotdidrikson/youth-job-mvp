-- A previous account setting never grants permission on an individual application.
create table private.application_ai_choices (
  youth_user_id uuid not null,
  job_id uuid not null,
  accepted_at timestamptz not null default statement_timestamp(),
  revoked_at timestamptz,
  notice_version integer not null default 1 check (notice_version = 1),
  primary key (youth_user_id, job_id),
  foreign key (youth_user_id, job_id)
    references public.application_completions(youth_user_id, job_id) on delete cascade
);
alter table private.application_ai_choices enable row level security;
revoke all on private.application_ai_choices from public, anon, authenticated;

create or replace function public.application_ai_allowed(p_job uuid, p_youth uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select exists(
   select 1 from private.application_ai_choices c
   join public.application_completions a using (youth_user_id, job_id)
   where c.job_id=p_job and c.youth_user_id=p_youth and c.revoked_at is null
     and a.status='submitted' and private.application_content_available(p_job,p_youth)
 );
$$;

-- Serialize with the ordinary submission and withdrawal functions. An
-- existing submission (including a retry) cannot acquire consent retroactively.
create function public.submit_my_application_with_ai(p_job_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid(); previous_status text; result jsonb;
begin
  if actor is null then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_job_id::text,0));
  select status into previous_status from public.application_completions
    where youth_user_id=actor and job_id=p_job_id;
  result := public.prepare_my_application(p_job_id);
  if result->>'status' = 'needs_completion' then
    result := public.save_my_application_answers(p_job_id, coalesce(result->'answers','{}'), true);
  end if;
  if result->>'status' = 'submitted' and (previous_status is null or previous_status='needs_completion') then
    insert into private.application_ai_choices(youth_user_id,job_id) values(actor,p_job_id)
      on conflict do nothing;
    -- The original submission trigger runs before the separate consent row exists.
    perform private.enqueue_application_analysis(p_job_id,actor);
  end if;
  return result;
end;
$$;

create function public.withdraw_my_application_ai(p_job_id uuid)
returns boolean language plpgsql security definer set search_path='' as $$
declare actor uuid := auth.uid();
begin
  if actor is null then raise insufficient_privilege; end if;
  perform pg_advisory_xact_lock(hashtextextended(actor::text||':'||p_job_id::text,0));
  update private.application_ai_choices set revoked_at=statement_timestamp()
    where youth_user_id=actor and job_id=p_job_id and revoked_at is null;
  return false;
end;
$$;

create function public.my_application_ai_status(p_job_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select public.application_ai_allowed(p_job_id,auth.uid());
$$;

revoke execute on function public.my_application_ai_preference(boolean) from authenticated;
revoke all on function public.submit_my_application_with_ai(uuid), public.withdraw_my_application_ai(uuid), public.my_application_ai_status(uuid) from public, anon;
grant execute on function public.submit_my_application_with_ai(uuid), public.withdraw_my_application_ai(uuid), public.my_application_ai_status(uuid) to authenticated;
