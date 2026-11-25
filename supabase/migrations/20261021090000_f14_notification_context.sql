-- F14: match and message notifications name the other party and the job and
-- open the exact conversation. match_id lets the chat mark its notices read
-- when the conversation is opened. A match keeps at most one unread message
-- notice per recipient, so the bell signals what still needs attention.
-- Older rows keep match_id null and the generic /chats link.
alter table public.notifications
  add column if not exists match_id uuid references public.matches(id) on delete cascade;
create index if not exists notifications_unread_match_idx
  on public.notifications(user_id, match_id) where read_at is null and match_id is not null;

-- `NEW` is a record whose fields depend on the table that fired the trigger.
-- Keep each table-specific field access in its own branch.
create or replace function public.create_mvp_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  match_row public.matches%rowtype;
  job_title text;
  youth_name text;
  company_name text;
  recipient uuid;
  sender_name text;
begin
  if TG_TABLE_NAME = 'swipe_actions' then
    if new.decision = 'interested' then
      insert into public.notifications(user_id, type, title, body, href)
      select j.company_user_id, 'candidate_interest', 'Ny kandidat',
        'En ungdom har visat intresse för ' || coalesce(nullif(trim(j.title), ''), 'din annons') || '.', '/company?view=kandidater'
      from public.jobs j
      where j.id = new.job_id;
    end if;
    return new;
  end if;

  if TG_TABLE_NAME = 'messages' then
    select m.* into match_row
    from public.conversations c join public.matches m on m.id = c.match_id
    where c.id = new.conversation_id;
    if not found then return new; end if;
  else
    match_row := new;
  end if;

  -- Same display names as get_my_conversation_contacts().
  select coalesce(nullif(trim(j.title), ''), 'jobbannonsen'),
    coalesce(nullif(trim(cp.company_name), ''), nullif(trim(j.company_name), ''), 'Företaget')
  into job_title, company_name
  from public.jobs j left join public.company_profiles cp on cp.user_id = match_row.company_user_id
  where j.id = match_row.job_id;
  select nullif(trim(y.full_name), '') into youth_name from public.youth_profiles y where y.user_id = match_row.youth_user_id;
  job_title := coalesce(job_title, 'jobbannonsen');
  company_name := coalesce(company_name, 'Företaget');
  youth_name := coalesce(youth_name, 'Kandidaten');

  if TG_TABLE_NAME = 'matches' and TG_OP = 'INSERT' then
    insert into public.notifications(user_id, type, title, body, href, match_id)
    values
      (match_row.youth_user_id, 'match', 'Ny match med ' || company_name, 'Ni kan börja chatta om ' || job_title || '.', '/chats?match=' || match_row.id, match_row.id),
      (match_row.company_user_id, 'match', 'Ny match med ' || youth_name, 'Ni kan börja chatta om ' || job_title || '.', '/chats?match=' || match_row.id, match_row.id);
  elsif TG_TABLE_NAME = 'messages' then
    recipient := case when new.sender_user_id = match_row.youth_user_id then match_row.company_user_id else match_row.youth_user_id end;
    sender_name := case when recipient = match_row.company_user_id then youth_name else company_name end;
    update public.notifications
    set title = 'Nya meddelanden från ' || sender_name, body = 'Gäller ' || job_title || '.', created_at = now()
    where user_id = recipient and type = 'message' and match_id = match_row.id and read_at is null;
    if not found then
      insert into public.notifications(user_id, type, title, body, href, match_id)
      values (recipient, 'message', 'Nytt meddelande från ' || sender_name, 'Gäller ' || job_title || '.',
        '/chats?conversation=' || new.conversation_id, match_row.id);
    end if;
  elsif TG_TABLE_NAME = 'matches' and TG_OP = 'UPDATE' and new.status is distinct from old.status then
    insert into public.notifications(user_id, type, title, body, href, match_id)
    values (match_row.youth_user_id, 'recruitment_status', 'Uppdaterad rekrytering hos ' || company_name,
      'Status för ' || job_title || ': ' || case new.status
        when 'in_contact' then 'kontakt pågår' when 'interview' then 'intervju' when 'hired' then 'anställning registrerad'
        when 'rejected' then 'avslutad' when 'cancelled' then 'avslutad' else 'matchad' end || '.',
      '/chats?match=' || match_row.id, match_row.id);
  end if;

  return new;
end;
$$;
revoke all on function public.create_mvp_notification() from public, anon, authenticated;
grant execute on function public.create_mvp_notification() to service_role;
