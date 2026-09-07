-- Trust & safety is deferred from the MVP. This intentionally removes the
-- staging report/block/admin data introduced by the release-hardening migration.
drop policy if exists "jobs visible active approved or owner" on public.jobs;
drop policy if exists "reports admins read" on public.reports;
drop policy if exists "reports admins update" on public.reports;
drop policy if exists "reports own create read" on public.reports;
drop policy if exists "reports own create" on public.reports;
drop policy if exists "admins read own membership" on public.admin_users;
drop policy if exists "messages matched unblocked participants write" on public.messages;
drop policy if exists "messages participant write" on public.messages;

create policy "jobs active or owner select" on public.jobs for select using (is_active = true or company_user_id = auth.uid());
create policy "messages matched participants write" on public.messages for insert with check (
  sender_user_id = auth.uid() and exists (
    select 1 from public.conversations c join public.matches m on m.id = c.match_id
    where c.id = conversation_id and auth.uid() in (c.youth_user_id, c.company_user_id)
      and m.youth_user_id = c.youth_user_id and m.company_user_id = c.company_user_id and m.job_id = c.job_id
  )
);

create or replace function public.review_candidate_and_match(p_job_id uuid, p_youth_user_id uuid, p_decision text)
returns table (match_id uuid, conversation_id uuid, matched boolean)
language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); created_match uuid; created_conversation uuid;
begin
  if p_decision not in ('interested', 'skip') then raise exception 'Invalid decision' using errcode = '22023'; end if;
  if not public.is_company_account(owner_id) then raise exception 'Only listing owners may review candidates' using errcode = '42501'; end if;
  if not exists (select 1 from public.jobs where id = p_job_id and company_user_id = owner_id) then raise exception 'Not your listing' using errcode = '42501'; end if;
  if not exists (select 1 from public.swipe_actions where job_id = p_job_id and youth_user_id = p_youth_user_id and decision = 'interested') then raise exception 'Candidate has not shown interest' using errcode = '42501'; end if;
  insert into public.company_interest_actions(company_user_id,youth_user_id,job_id,decision) values(owner_id,p_youth_user_id,p_job_id,p_decision) on conflict (company_user_id,youth_user_id,job_id) do update set decision = excluded.decision;
  if p_decision <> 'interested' then return query select null::uuid,null::uuid,false; return; end if;
  insert into public.matches(youth_user_id,company_user_id,job_id,status) values(p_youth_user_id,owner_id,p_job_id,'matched') on conflict (youth_user_id,company_user_id,job_id) do update set status = public.matches.status returning id into created_match;
  insert into public.conversations(match_id,youth_user_id,company_user_id,job_id) values(created_match,p_youth_user_id,owner_id,p_job_id) on conflict (match_id) do update set match_id = public.conversations.match_id returning id into created_conversation;
  return query select created_match,created_conversation,true;
end;
$$;

drop function if exists public.users_are_blocked(uuid, uuid);
drop function if exists public.is_admin_account(uuid);
drop table if exists public.reports;
drop table if exists public.user_blocks;
drop table if exists public.admin_users;
alter table public.jobs drop constraint if exists jobs_moderation_status_check;
alter table public.jobs drop column if exists moderation_status;
