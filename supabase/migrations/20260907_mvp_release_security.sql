-- MVP release hardening. Apply after every existing migration.

-- A user may choose a role at signup, but can never promote themselves later.
create or replace function public.prevent_profile_role_change()
returns trigger language plpgsql set search_path = public as $$
begin
  if new.role is distinct from old.role then
    raise exception 'Profile roles cannot be changed by an account' using errcode = '42501';
  end if;
  return new;
end;
$$;
drop trigger if exists profiles_prevent_role_change on public.profiles;
create trigger profiles_prevent_role_change before update on public.profiles
for each row execute function public.prevent_profile_role_change();

-- Trust and moderation data. admin_users is an allow-list managed with the
-- service-role/Supabase dashboard, never by the browser.
create table if not exists public.admin_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admin_users enable row level security;
create policy "admins read own membership" on public.admin_users for select using (user_id = auth.uid());

create or replace function public.is_admin_account(check_user_id uuid default auth.uid())
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admin_users where user_id = check_user_id);
$$;

-- Reports and notifications are written by database triggers, not clients.
drop policy if exists "notifications own manage" on public.notifications;
create policy "notifications own read" on public.notifications for select using (user_id = auth.uid());
create policy "notifications own update" on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "reports admins read" on public.reports for select using (reporter_user_id = auth.uid() or public.is_admin_account());
create policy "reports admins update" on public.reports for update using (public.is_admin_account()) with check (public.is_admin_account());

-- Hide removed/unapproved listings from everyone except their owner and admins.
drop policy if exists "jobs active or owner select" on public.jobs;
create policy "jobs visible active approved or owner" on public.jobs for select using (
  company_user_id = auth.uid() or public.is_admin_account() or (is_active = true and moderation_status = 'approved')
);

-- Blocks affect both match creation and chat delivery.
create or replace function public.users_are_blocked(first_user uuid, second_user uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_blocks where (blocker_user_id = first_user and blocked_user_id = second_user) or (blocker_user_id = second_user and blocked_user_id = first_user));
$$;

-- Replace permissive legacy policies with relationship-bound ones.
drop policy if exists "matches company write" on public.matches;
drop policy if exists "matches company update lifecycle" on public.matches;
drop policy if exists "conversations company create" on public.conversations;
drop policy if exists "conversations participants update" on public.conversations;
create policy "matches owner update lifecycle" on public.matches for update
using (company_user_id = auth.uid() and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid()))
with check (company_user_id = auth.uid() and exists (select 1 from public.jobs where id = job_id and company_user_id = auth.uid()));
-- No insert policies: only the security-definer RPC below can create matches/conversations.
create policy "conversations participants update timestamp" on public.conversations for update
using (auth.uid() in (youth_user_id, company_user_id))
with check (auth.uid() in (youth_user_id, company_user_id));

drop policy if exists "messages participant write" on public.messages;
create policy "messages matched unblocked participants write" on public.messages for insert with check (
  sender_user_id = auth.uid() and exists (
    select 1 from public.conversations c join public.matches m on m.id = c.match_id
    where c.id = conversation_id and auth.uid() in (c.youth_user_id, c.company_user_id)
      and m.youth_user_id = c.youth_user_id and m.company_user_id = c.company_user_id and m.job_id = c.job_id
      and not public.users_are_blocked(c.youth_user_id, c.company_user_id)
  )
);

create or replace function public.touch_conversation_after_message()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update public.conversations set last_message_at = new.created_at where id = new.conversation_id;
  return new;
end;
$$;
drop trigger if exists messages_touch_conversation on public.messages;
create trigger messages_touch_conversation after insert on public.messages
for each row execute function public.touch_conversation_after_message();

-- Atomic company decision + mutual match creation. Unique constraints already
-- protect rows; ON CONFLICT makes retries and concurrent requests safe.
create or replace function public.review_candidate_and_match(p_job_id uuid, p_youth_user_id uuid, p_decision text)
returns table (match_id uuid, conversation_id uuid, matched boolean)
language plpgsql security definer set search_path = public as $$
declare owner_id uuid := auth.uid(); created_match uuid; created_conversation uuid;
begin
  if p_decision not in ('interested', 'skip') then raise exception 'Invalid decision' using errcode = '22023'; end if;
  if not public.is_company_account(owner_id) then raise exception 'Only listing owners may review candidates' using errcode = '42501'; end if;
  if not exists (select 1 from public.jobs where id = p_job_id and company_user_id = owner_id) then raise exception 'Not your listing' using errcode = '42501'; end if;
  if not exists (select 1 from public.swipe_actions where job_id = p_job_id and youth_user_id = p_youth_user_id and decision = 'interested') then raise exception 'Candidate has not shown interest' using errcode = '42501'; end if;
  insert into public.company_interest_actions(company_user_id,youth_user_id,job_id,decision)
  values(owner_id,p_youth_user_id,p_job_id,p_decision)
  on conflict (company_user_id,youth_user_id,job_id) do update set decision = excluded.decision;
  if p_decision <> 'interested' or public.users_are_blocked(owner_id,p_youth_user_id) then return query select null::uuid,null::uuid,false; return; end if;
  insert into public.matches(youth_user_id,company_user_id,job_id,status)
  values(p_youth_user_id,owner_id,p_job_id,'matched')
  on conflict (youth_user_id,company_user_id,job_id) do update set status = public.matches.status
  returning id into created_match;
  insert into public.conversations(match_id,youth_user_id,company_user_id,job_id)
  values(created_match,p_youth_user_id,owner_id,p_job_id)
  on conflict (match_id) do update set match_id = public.conversations.match_id
  returning id into created_conversation;
  return query select created_match,created_conversation,true;
end;
$$;
revoke all on function public.review_candidate_and_match(uuid,uuid,text) from public;
grant execute on function public.review_candidate_and_match(uuid,uuid,text) to authenticated;

-- Notification events.
create or replace function public.create_mvp_notification()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_TABLE_NAME = 'swipe_actions' and new.decision = 'interested' then
    insert into public.notifications(user_id,type,title,body,href) select j.company_user_id,'candidate_interest','Ny kandidat','En ungdom har visat intresse.', '/company?view=kandidater' from public.jobs j where j.id = new.job_id;
  elsif TG_TABLE_NAME = 'matches' and TG_OP = 'INSERT' then
    insert into public.notifications(user_id,type,title,body,href) values (new.youth_user_id,'match','Ny match','Du har fått en ny match.', '/chats'), (new.company_user_id,'match','Ny match','Du har fått en ny match.', '/chats');
  elsif TG_TABLE_NAME = 'messages' then
    insert into public.notifications(user_id,type,title,body,href) select case when c.youth_user_id = new.sender_user_id then c.company_user_id else c.youth_user_id end,'message','Nytt meddelande','Du har fått ett nytt meddelande.', '/chats' from public.conversations c where c.id = new.conversation_id;
  elsif TG_TABLE_NAME = 'matches' and TG_OP = 'UPDATE' and new.status is distinct from old.status then
    insert into public.notifications(user_id,type,title,body,href) values(new.youth_user_id,'recruitment_status','Uppdaterad rekrytering','Din matchstatus har ändrats.', '/chats');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_interest on public.swipe_actions; create trigger notify_interest after insert or update of decision on public.swipe_actions for each row execute function public.create_mvp_notification();
drop trigger if exists notify_match on public.matches; create trigger notify_match after insert on public.matches for each row execute function public.create_mvp_notification();
drop trigger if exists notify_match_status on public.matches; create trigger notify_match_status after update of status on public.matches for each row execute function public.create_mvp_notification();
drop trigger if exists notify_message on public.messages; create trigger notify_message after insert on public.messages for each row execute function public.create_mvp_notification();

-- Atomic per-user endpoint quota. Call only after server-side JWT verification.
create table if not exists public.api_rate_limits (user_id uuid not null references auth.users(id) on delete cascade, endpoint text not null, window_started_at timestamptz not null default now(), request_count integer not null default 0, primary key(user_id, endpoint));
alter table public.api_rate_limits enable row level security;
create or replace function public.consume_api_quota(p_endpoint text, p_limit integer)
returns boolean language plpgsql security definer set search_path = public as $$
declare current_count integer; current_window timestamptz;
begin
  if auth.uid() is null then raise exception 'Unauthenticated' using errcode = '42501'; end if;
  insert into public.api_rate_limits(user_id,endpoint) values(auth.uid(),p_endpoint) on conflict do nothing;
  select request_count,window_started_at into current_count,current_window from public.api_rate_limits where user_id=auth.uid() and endpoint=p_endpoint for update;
  if current_window < now() - interval '1 hour' then update public.api_rate_limits set window_started_at=now(),request_count=1 where user_id=auth.uid() and endpoint=p_endpoint; return true; end if;
  if current_count >= p_limit then return false; end if;
  update public.api_rate_limits set request_count=request_count+1 where user_id=auth.uid() and endpoint=p_endpoint; return true;
end;
$$;
revoke all on function public.consume_api_quota(text,integer) from public;
grant execute on function public.consume_api_quota(text,integer) to authenticated;
