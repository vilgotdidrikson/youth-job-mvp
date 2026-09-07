-- `NEW` is a record whose fields depend on the table that fired the trigger.
-- Referencing NEW.decision in the same conditional as a matches/messages
-- trigger raises "record new has no field decision" before a match can be
-- created. Keep each table-specific field access in its own branch.
create or replace function public.create_mvp_notification()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if TG_TABLE_NAME = 'swipe_actions' then
    if new.decision = 'interested' then
      insert into public.notifications(user_id, type, title, body, href)
      select j.company_user_id, 'candidate_interest', 'Ny kandidat', 'En ungdom har visat intresse.', '/company?view=kandidater'
      from public.jobs j
      where j.id = new.job_id;
    end if;
  elsif TG_TABLE_NAME = 'matches' and TG_OP = 'INSERT' then
    insert into public.notifications(user_id, type, title, body, href)
    values
      (new.youth_user_id, 'match', 'Ny match', 'Du har fått en ny match.', '/chats'),
      (new.company_user_id, 'match', 'Ny match', 'Du har fått en ny match.', '/chats');
  elsif TG_TABLE_NAME = 'messages' then
    insert into public.notifications(user_id, type, title, body, href)
    select
      case when c.youth_user_id = new.sender_user_id then c.company_user_id else c.youth_user_id end,
      'message', 'Nytt meddelande', 'Du har fått ett nytt meddelande.', '/chats'
    from public.conversations c
    where c.id = new.conversation_id;
  elsif TG_TABLE_NAME = 'matches' and TG_OP = 'UPDATE' and new.status is distinct from old.status then
    insert into public.notifications(user_id, type, title, body, href)
    values (new.youth_user_id, 'recruitment_status', 'Uppdaterad rekrytering', 'Din matchstatus har ändrats.', '/chats');
  end if;

  return new;
end;
$$;
