-- Public job details already obey the jobs table RLS policy. Running this
-- filtered read as the caller removes an unnecessary RLS bypass while keeping
-- owner access to drafts and public access to active published listings.
alter function public.get_job_direct_detail(uuid) security invoker;

revoke all on function public.get_job_direct_detail(uuid) from public, anon, authenticated;
grant execute on function public.get_job_direct_detail(uuid) to anon, authenticated, service_role;
