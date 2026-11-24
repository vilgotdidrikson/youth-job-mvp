-- Configuration only. Run on the intended project for the full pilot release.
begin read only;

with checks(name, ready) as (
  values
    ('F20 per-application AI choice', to_regprocedure('public.submit_my_application_with_ai(uuid)') is not null
      and to_regprocedure('public.withdraw_my_application_ai(uuid)') is not null),
    ('F20 previous account opt-in disabled', not coalesce(has_function_privilege(
      'authenticated',to_regprocedure('public.my_application_ai_preference(boolean)'),'EXECUTE'), false)),
    ('L12 private work cleanup available', to_regprocedure('private.purge_inactive_cv_work(integer)') is not null),
    ('L15 company agreement flow available', to_regprocedure('public.accept_my_company_agreement(text,text,text,boolean,boolean)') is not null
      and to_regprocedure('public.get_pending_company_agreements()') is not null),
    ('F20 application AI gate', to_regprocedure('public.application_ai_allowed(uuid,uuid)') is not null),
    ('L15 recruitment notice available', to_regprocedure('public.get_job_recruitment_notice(uuid)') is not null),
    ('L15 company agreement receipt archive available', to_regclass('private.closed_company_agreement_receipts') is not null),
    ('L15 youth terms flow available', to_regprocedure('public.accept_my_youth_terms(text,boolean)') is not null),
    ('L13 reviewed export delivery', to_regclass('private.privacy_case_deliveries') is not null),
    ('L16 private case attachments', to_regclass('private.privacy_case_attachments') is not null),
    ('L16 incident intake', exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'create_incident_privacy_case'
    )),
    ('L16 deadline reminders', to_regprocedure('private.notify_privacy_case_deadlines()') is not null),
    ('L15 age guard enabled', exists (
      select 1 from pg_trigger
      where tgrelid = to_regclass('public.youth_profiles') and tgname = 'validate_youth_age' and tgenabled in ('O', 'A')
    )),
    ('DA-18 anonymous preview available', coalesce(
      has_function_privilege('anon', to_regprocedure('public.list_public_job_previews()'), 'EXECUTE'), false
    )),
    ('DA-18 anonymous full job reads disabled', not has_any_column_privilege('anon', 'public.jobs', 'SELECT')),
    ('L10 youth documents bucket private', exists (
      select 1 from storage.buckets where id = 'youth-documents' and not public
    ))
)
select jsonb_build_object(
  'ready', bool_and(ready),
  'failed', coalesce(jsonb_agg(name order by name) filter (where not ready), '[]'::jsonb),
  'passed', coalesce(jsonb_agg(name order by name) filter (where ready), '[]'::jsonb)
) as launch_schema
from checks;

rollback;
