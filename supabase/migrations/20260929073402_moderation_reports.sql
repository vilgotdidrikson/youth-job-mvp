-- User reporting and admin moderation. Reports are submitted through a
-- validated RPC so clients never receive direct write access to the table.

create table public.moderation_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_user_id uuid not null references auth.users(id) on delete cascade,
  target_type text not null,
  target_id uuid not null,
  reason text not null,
  details text,
  status text not null default 'open',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by_user_id uuid references auth.users(id) on delete set null,
  resolution_note text,
  constraint moderation_reports_target_type_check
    check (target_type in ('job', 'conversation', 'message', 'user')),
  constraint moderation_reports_reason_check
    check (reason in ('scam', 'harassment', 'discrimination', 'inappropriate', 'privacy', 'other')),
  constraint moderation_reports_status_check
    check (status in ('open', 'reviewing', 'resolved', 'dismissed')),
  constraint moderation_reports_details_length_check
    check (details is null or char_length(details) <= 2000),
  constraint moderation_reports_resolution_length_check
    check (resolution_note is null or char_length(resolution_note) <= 2000)
);

create index moderation_reports_status_created_idx
  on public.moderation_reports(status, created_at desc);
create index moderation_reports_reporter_idx
  on public.moderation_reports(reporter_user_id, created_at desc);
create unique index moderation_reports_one_active_per_target_idx
  on public.moderation_reports(reporter_user_id, target_type, target_id)
  where status in ('open', 'reviewing');

alter table public.moderation_reports enable row level security;

revoke all on table public.moderation_reports from anon, authenticated;
grant select on table public.moderation_reports to authenticated;

create policy "reporters read own reports"
  on public.moderation_reports for select
  to authenticated
  using ((select auth.uid()) = reporter_user_id);

create policy "admins read moderation reports"
  on public.moderation_reports for select
  to authenticated
  using ((select public.is_admin_account()));

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

  insert into public.moderation_reports(
    reporter_user_id, target_type, target_id, reason, details
  ) values (
    caller_id, p_target_type, p_target_id, p_reason, normalized_details
  ) returning id into report_id;

  return report_id;
end;
$$;

revoke execute on function public.submit_moderation_report(text, uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.submit_moderation_report(text, uuid, text, text)
  to authenticated;

create or replace function public.get_moderation_reports()
returns table (
  id uuid,
  reporter_user_id uuid,
  target_type text,
  target_id uuid,
  reason text,
  details text,
  status text,
  created_at timestamptz,
  target_summary text
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
      end as target_summary
    from public.moderation_reports report
    order by
      case report.status when 'open' then 0 when 'reviewing' then 1 else 2 end,
      report.created_at desc;
end;
$$;

revoke execute on function public.get_moderation_reports()
  from public, anon, authenticated;
grant execute on function public.get_moderation_reports()
  to authenticated;

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

  if report_owner is null then
    raise exception 'Report not found' using errcode = 'P0002';
  end if;

  if p_status in ('resolved', 'dismissed') then
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

revoke execute on function public.review_moderation_report(uuid, text, text)
  from public, anon, authenticated;
grant execute on function public.review_moderation_report(uuid, text, text)
  to authenticated;
