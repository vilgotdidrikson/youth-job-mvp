-- An anonymous visitor can read only the preview, never a full job row.
revoke select on table public.jobs from anon;
alter policy "jobs published active or owner select" on public.jobs to authenticated;
revoke execute on function public.get_job_direct_detail(uuid) from public, anon;

create function public.list_public_job_previews()
returns table(id uuid, title text, city text)
language sql stable security definer
set search_path = ''
as $$
  select j.id, j.title::text, j.city::text
  from public.jobs j
  where j.job_kind = 'employment'
    and j.is_active
    and j.status = 'active'
    and j.publication_status = 'published'
    and public.is_verified_company(j.company_user_id)
  order by j.created_at desc, j.id desc
  limit 6;
$$;

revoke all on function public.list_public_job_previews() from public;
grant execute on function public.list_public_job_previews() to anon, authenticated;
