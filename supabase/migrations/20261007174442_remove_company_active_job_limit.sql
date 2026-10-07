-- Companies may create and reactivate multiple recruitment announcements.
-- Ownership RLS, verification/publication and lifecycle triggers remain intact.
drop trigger if exists jobs_enforce_company_active_limit on public.jobs;
drop function if exists public.enforce_company_active_job_limit();
