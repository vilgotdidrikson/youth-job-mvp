-- The all-applications workspace must retain the participant block boundary.
create or replace function public.get_company_candidates(p_job_id uuid)
returns table (
  user_id uuid, full_name text, age integer, city text, desired_roles text[],
  employment_preferences text[], strengths text[], work_experience text[],
  education text[], languages text[], cv_text text,
  work_experience_details jsonb, education_details jsonb
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not public.is_verified_company() or not exists (
    select 1 from public.jobs where id = p_job_id and company_user_id = auth.uid()
  ) then
    raise exception 'A verified company is required to view candidates' using errcode = '42501';
  end if;

  return query
    select yp.user_id, yp.full_name, yp.age, yp.city, yp.desired_roles,
      yp.employment_preferences, yp.strengths, yp.work_experience, yp.education,
      yp.languages, null::text,
      coalesce(yp.cv_structured->'workExperience', '[]'::jsonb),
      coalesce(yp.cv_structured->'education', '[]'::jsonb)
    from public.youth_profiles yp
    join public.swipe_actions swipe on swipe.youth_user_id = yp.user_id
    where swipe.job_id = p_job_id and swipe.decision = 'interested' and not public.users_are_blocked(auth.uid(),yp.user_id);
end;
$$;
revoke all on function public.get_company_candidates(uuid) from public,anon;
grant execute on function public.get_company_candidates(uuid) to authenticated,service_role;
