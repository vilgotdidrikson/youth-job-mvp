-- The function return column `match_id` is also a PL/pgSQL variable.  Using
-- `ON CONFLICT (match_id)` against conversations is therefore ambiguous.
-- Insert once and, on a retry, look up the already-created conversation.
create or replace function public.review_candidate_and_match(p_job_id uuid, p_youth_user_id uuid, p_decision text)
returns table (match_id uuid, conversation_id uuid, matched boolean)
language plpgsql
security definer
set search_path = public
as $$
declare
  owner_id uuid := auth.uid();
  created_match uuid;
  created_conversation uuid;
begin
  if p_decision not in ('interested', 'skip') then
    raise exception 'Invalid decision' using errcode = '22023';
  end if;

  if not public.is_company_account(owner_id) then
    raise exception 'Only listing owners may review candidates' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.jobs where id = p_job_id and company_user_id = owner_id
  ) then
    raise exception 'Not your listing' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.swipe_actions
    where job_id = p_job_id and youth_user_id = p_youth_user_id and decision = 'interested'
  ) then
    raise exception 'Candidate has not shown interest' using errcode = '42501';
  end if;

  insert into public.company_interest_actions(company_user_id, youth_user_id, job_id, decision)
  values (owner_id, p_youth_user_id, p_job_id, p_decision)
  on conflict (company_user_id, youth_user_id, job_id)
  do update set decision = excluded.decision;

  if p_decision <> 'interested' then
    return query select null::uuid, null::uuid, false;
    return;
  end if;

  insert into public.matches(youth_user_id, company_user_id, job_id, status)
  values (p_youth_user_id, owner_id, p_job_id, 'matched')
  on conflict (youth_user_id, company_user_id, job_id)
  do update set status = public.matches.status
  returning id into created_match;

  insert into public.conversations(match_id, youth_user_id, company_user_id, job_id)
  values (created_match, p_youth_user_id, owner_id, p_job_id)
  on conflict do nothing
  returning id into created_conversation;

  if created_conversation is null then
    select c.id into created_conversation
    from public.conversations c
    where c.match_id = created_match;
  end if;

  return query select created_match, created_conversation, true;
end;
$$;

revoke all on function public.review_candidate_and_match(uuid, uuid, text) from public;
grant execute on function public.review_candidate_and_match(uuid, uuid, text) to authenticated;
