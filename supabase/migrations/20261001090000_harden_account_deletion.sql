-- Account deletion hardening. See docs/account-deletion.md for the full
-- retention map. Participant data still cascades with the auth user; this
-- migration only (1) lets an intended ON DELETE SET NULL through the company
-- verification guard and (2) keeps moderation evidence after either party
-- deletes their account.

-- 1. A deleted admin reviewer must not stay referenced by verified companies.
-- The FK action runs as UPDATE ... SET verified_by_user_id = NULL without a JWT,
-- so the guard previously restored the old value and left a dangling reference.
-- SECURITY DEFINER lets the guard read auth.users; trigger functions are not
-- callable as RPCs and do not need EXECUTE for the roles that fire them.
create or replace function public.protect_company_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if public.is_admin_account() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.verification_status := 'pending';
    new.verification_submitted_at := case when new.organization_number is not null then now() else null end;
    new.verified_at := null;
    new.verified_by_user_id := null;
    new.verification_rejection_reason := null;
    return new;
  end if;

  if new.organization_number is distinct from old.organization_number then
    new.verification_status := 'pending';
    new.verification_submitted_at := now();
    new.verified_at := null;
    new.verified_by_user_id := null;
    new.verification_rejection_reason := null;
  elsif old.verification_status = 'rejected' then
    new.verification_status := 'pending';
    new.verification_submitted_at := now();
    new.verified_at := null;
    new.verified_by_user_id := null;
    new.verification_rejection_reason := null;
  else
    new.verification_status := old.verification_status;
    new.verification_submitted_at := old.verification_submitted_at;
    new.verified_at := old.verified_at;
    new.verification_rejection_reason := old.verification_rejection_reason;
    -- Only the FK action for a reviewer that no longer exists may clear this.
    new.verified_by_user_id := case
      when new.verified_by_user_id is null
        and old.verified_by_user_id is not null
        and not exists (select 1 from auth.users where id = old.verified_by_user_id)
      then null
      else old.verified_by_user_id
    end;
  end if;
  return new;
end;
$$;

revoke all on function public.protect_company_verification_fields() from public, anon, authenticated;
grant execute on function public.protect_company_verification_fields() to service_role;

-- 2. Moderation reports outlive both reporter and target accounts. The
-- reporter is anonymised instead of deleting the report, and the reported
-- content is snapshotted at submission so a reported user cannot erase the
-- evidence by deleting their account. Closed reports are purged after 12
-- months by purge_closed_moderation_reports().
alter table public.moderation_reports
  alter column reporter_user_id drop not null,
  add column if not exists target_snapshot jsonb;

alter table public.moderation_reports
  drop constraint if exists moderation_reports_reporter_user_id_fkey;
alter table public.moderation_reports
  add constraint moderation_reports_reporter_user_id_fkey
  foreign key (reporter_user_id)
  references auth.users(id)
  on delete set null;

-- Reporters keep reading their own reports, but the evidence snapshot is
-- admin-only and served exclusively through get_moderation_reports().
revoke select on table public.moderation_reports from authenticated;
grant select (
  id, reporter_user_id, target_type, target_id, reason, details, status,
  created_at, reviewed_at, reviewed_by_user_id, resolution_note
) on table public.moderation_reports to authenticated;

create or replace function public.submit_moderation_report(
  p_target_type text,
  p_target_id uuid,
  p_reason text,
  p_details text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  caller_id uuid := auth.uid();
  normalized_details text := nullif(btrim(p_details), '');
  report_id uuid;
  snapshot jsonb;
begin
  if caller_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_target_type not in ('job', 'conversation', 'message', 'user') then
    raise exception 'Invalid report target' using errcode = '22023';
  end if;
  if p_reason not in ('scam', 'harassment', 'discrimination', 'inappropriate', 'privacy', 'other') then
    raise exception 'Invalid report reason' using errcode = '22023';
  end if;
  if char_length(coalesce(normalized_details, '')) > 2000 then
    raise exception 'Report details are too long' using errcode = '22023';
  end if;

  if p_target_type = 'job' then
    if not exists (
      select 1 from public.jobs job
      where job.id = p_target_id
        and (job.company_user_id = caller_id or job.publication_status = 'published')
    ) then
      raise exception 'Report target is not accessible' using errcode = '42501';
    end if;
  elsif p_target_type = 'conversation' then
    if not exists (
      select 1 from public.conversations conversation
      where conversation.id = p_target_id
        and caller_id in (conversation.youth_user_id, conversation.company_user_id)
    ) then
      raise exception 'Report target is not accessible' using errcode = '42501';
    end if;
  elsif p_target_type = 'message' then
    if not exists (
      select 1
      from public.messages message
      join public.conversations conversation on conversation.id = message.conversation_id
      where message.id = p_target_id
        and caller_id in (conversation.youth_user_id, conversation.company_user_id)
    ) then
      raise exception 'Report target is not accessible' using errcode = '42501';
    end if;
  else
    if p_target_id = caller_id or not exists (
      select 1 from public.conversations conversation
      where caller_id in (conversation.youth_user_id, conversation.company_user_id)
        and p_target_id in (conversation.youth_user_id, conversation.company_user_id)
    ) then
      raise exception 'Report target is not accessible' using errcode = '42501';
    end if;
  end if;

  select report.id into report_id
  from public.moderation_reports report
  where report.reporter_user_id = caller_id
    and report.target_type = p_target_type
    and report.target_id = p_target_id
    and report.status in ('open', 'reviewing')
  limit 1;

  if report_id is not null then
    return report_id;
  end if;

  -- The snapshot holds only content the reporter could already see.
  if p_target_type = 'job' then
    select jsonb_build_object(
      'title', job.title, 'company_name', job.company_name, 'company_user_id', job.company_user_id,
      'description', job.description, 'city', job.city, 'created_at', job.created_at
    ) into snapshot
    from public.jobs job where job.id = p_target_id;
  elsif p_target_type = 'message' then
    select jsonb_build_object(
      'conversation_id', message.conversation_id, 'sender_user_id', message.sender_user_id,
      'message_text', message.message_text, 'created_at', message.created_at
    ) into snapshot
    from public.messages message where message.id = p_target_id;
  elsif p_target_type = 'conversation' then
    select jsonb_build_object(
      'youth_user_id', conversation.youth_user_id, 'company_user_id', conversation.company_user_id,
      'job_id', conversation.job_id,
      'messages', coalesce((
        select jsonb_agg(jsonb_build_object(
          'sender_user_id', recent.sender_user_id, 'message_text', recent.message_text, 'created_at', recent.created_at
        ) order by recent.created_at)
        from (
          select message.sender_user_id, message.message_text, message.created_at
          from public.messages message
          where message.conversation_id = conversation.id
          order by message.created_at desc
          limit 50
        ) recent
      ), '[]'::jsonb)
    ) into snapshot
    from public.conversations conversation where conversation.id = p_target_id;
  else
    select jsonb_build_object(
      'user_id', profile.id, 'role', profile.role,
      'display_name', coalesce(nullif(youth.full_name, ''), nullif(company.company_name, ''))
    ) into snapshot
    from public.profiles profile
    left join public.youth_profiles youth on youth.user_id = profile.id
    left join public.company_profiles company on company.user_id = profile.id
    where profile.id = p_target_id;
  end if;

  insert into public.moderation_reports(
    reporter_user_id, target_type, target_id, reason, details, target_snapshot
  ) values (
    caller_id, p_target_type, p_target_id, p_reason, normalized_details, snapshot
  ) returning id into report_id;

  return report_id;
end;
$$;

revoke all on function public.submit_moderation_report(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_moderation_report(text, uuid, text, text)
  to authenticated, service_role;

-- The return type changes, so the function must be dropped first.
drop function if exists public.get_moderation_reports();
create function public.get_moderation_reports()
returns table (
  id uuid,
  reporter_user_id uuid,
  target_type text,
  target_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  target_summary text,
  target_snapshot jsonb
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin_account() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;

  return query
    select report.id,
      report.reporter_user_id,
      report.target_type,
      report.target_id,
      report.reason,
      report.details,
      report.status,
      report.created_at,
      case report.target_type
        when 'job' then coalesce((select job.title from public.jobs job where job.id = report.target_id), 'Borttagen jobbannons')
        when 'conversation' then 'Konversation ' || left(report.target_id::text, 8)
        when 'message' then 'Meddelande ' || left(report.target_id::text, 8)
        else 'Användare ' || left(report.target_id::text, 8)
      end as target_summary,
      report.target_snapshot
    from public.moderation_reports report
    order by
      case report.status when 'open' then 0 when 'reviewing' then 1 else 2 end,
      report.created_at desc;
end;
$$;

revoke all on function public.get_moderation_reports() from public, anon, authenticated;
grant execute on function public.get_moderation_reports() to authenticated, service_role;

-- A report whose reporter deleted their account can still be reviewed; the
-- outcome notification is simply skipped.
create or replace function public.review_moderation_report(
  p_report_id uuid,
  p_status text,
  p_resolution_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  report_owner uuid;
  normalized_note text := nullif(btrim(p_resolution_note), '');
begin
  if not public.is_admin_account() then
    raise exception 'Admin access required' using errcode = '42501';
  end if;
  if p_status not in ('reviewing', 'resolved', 'dismissed') then
    raise exception 'Invalid moderation status' using errcode = '22023';
  end if;
  if char_length(coalesce(normalized_note, '')) > 2000 then
    raise exception 'Resolution note is too long' using errcode = '22023';
  end if;

  update public.moderation_reports
  set status = p_status,
      reviewed_at = case when p_status in ('resolved', 'dismissed') then now() else null end,
      reviewed_by_user_id = auth.uid(),
      resolution_note = normalized_note
  where id = p_report_id
  returning reporter_user_id into report_owner;

  if not found then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if p_status in ('resolved', 'dismissed') and report_owner is not null then
    insert into public.notifications(user_id, type, title, body, href)
    values (
      report_owner,
      'moderation_report',
      'Din anmälan har granskats',
      case when p_status = 'resolved'
        then 'Vi har granskat din anmälan och vidtagit lämpliga åtgärder.'
        else 'Vi har granskat din anmälan och avslutat ärendet.'
      end,
      '/notifications'
    );
  end if;
end;
$$;

revoke all on function public.review_moderation_report(uuid, text, text) from public, anon, authenticated;
grant execute on function public.review_moderation_report(uuid, text, text) to authenticated, service_role;

-- Storage limitation for moderation evidence: closed reports are kept for 12
-- months after review, then deleted. Service role only; schedule it before
-- release (see docs/account-deletion.md).
create or replace function public.purge_closed_moderation_reports(p_retention interval default interval '12 months')
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  purged integer;
begin
  if p_retention < interval '30 days' then
    raise exception 'Retention must be at least 30 days' using errcode = '22023';
  end if;

  delete from public.moderation_reports
  where status in ('resolved', 'dismissed')
    and reviewed_at < now() - p_retention;
  get diagnostics purged = row_count;
  return purged;
end;
$$;

revoke all on function public.purge_closed_moderation_reports(interval) from public, anon, authenticated;
grant execute on function public.purge_closed_moderation_reports(interval) to service_role;
