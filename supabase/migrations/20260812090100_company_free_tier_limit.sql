-- Free company accounts may keep one active recruitment listing at a time.
create or replace function public.enforce_company_active_job_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'active' and exists (
    select 1 from public.profiles where id = new.company_user_id and role = 'company'
  ) and exists (
    select 1 from public.jobs
    where company_user_id = new.company_user_id
      and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid)
      and status = 'active'
  ) then
    raise exception 'Free company accounts can have one active recruitment at a time' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists jobs_enforce_company_active_limit on public.jobs;
create trigger jobs_enforce_company_active_limit
  before insert or update of status on public.jobs
  for each row execute function public.enforce_company_active_job_limit();
