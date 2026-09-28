-- The deployed matches schema has no updated_at column. Replace only the
-- hire RPC body; all authorization and event semantics remain unchanged.
create or replace function public.mark_match_hired(p_match_id uuid)
returns setof public.matches
language plpgsql
security definer
set search_path = public
as $$
declare
  completed_match public.matches;
begin
  if auth.uid() is null or not public.is_company_account() then
    raise exception 'Only the company that owns a match can complete a hire' using errcode = '42501';
  end if;

  select match_row.* into completed_match
  from public.matches match_row
  join public.jobs job on job.id = match_row.job_id
  join public.conversations conversation on conversation.match_id = match_row.id
    and conversation.job_id = match_row.job_id
    and conversation.company_user_id = match_row.company_user_id
    and conversation.youth_user_id = match_row.youth_user_id
  where match_row.id = p_match_id
    and match_row.company_user_id = auth.uid()
    and job.company_user_id = auth.uid()
    and match_row.status in ('matched', 'in_contact', 'interview')
  for update of match_row;

  if not found then
    raise exception 'Match is not eligible to be marked as hired' using errcode = '42501';
  end if;

  update public.matches
  set status = 'hired',
      hire_completed_at = now(),
      hired_by_user_id = auth.uid()
  where id = completed_match.id
  returning * into completed_match;

  return next completed_match;
end;
$$;
