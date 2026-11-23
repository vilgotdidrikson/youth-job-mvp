-- Configuration only. Run on the intended project for the full pilot release.
begin read only;

with checks(name, ready) as (
  values
    ('F20 application AI preference', to_regprocedure('public.my_application_ai_preference(boolean)') is not null),
    ('F20 application AI gate', to_regprocedure('public.application_ai_allowed(uuid,uuid)') is not null),
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
