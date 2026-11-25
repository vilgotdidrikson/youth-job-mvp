-- N14: one listing, multiple workplaces. Existing jobs keep their legacy address.
alter table public.jobs add column workplaces jsonb not null default '[]'::jsonb;

create function public.validate_job_workplaces()
returns trigger language plpgsql security invoker set search_path = public, pg_catalog as $$
declare p jsonb; ids text[] := '{}'; first_place jsonb; lon numeric; lat numeric;
begin
 if jsonb_typeof(new.workplaces) is distinct from 'array' or jsonb_array_length(new.workplaces)>10 or octet_length(new.workplaces::text)>20000 then
  raise check_violation using message='Ange högst tio arbetsplatser.';
 end if;
 if tg_op='UPDATE' and new.workplaces is not distinct from old.workplaces and jsonb_array_length(new.workplaces)>0
   and (new.address,new.postal_code,new.city,new.longitude,new.latitude) is distinct from
       (old.address,old.postal_code,old.city,old.longitude,old.latitude) then
  new.workplaces:=jsonb_set(new.workplaces,'{0}',(new.workplaces->0)||jsonb_build_object('address',new.address,'postal_code',new.postal_code,'city',new.city,'longitude',new.longitude,'latitude',new.latitude));
 end if;
 for p in select value from jsonb_array_elements(new.workplaces) loop
  if jsonb_typeof(p) is distinct from 'object' or coalesce(p->>'id','') !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
     or lower(p->>'id')=any(ids) then raise check_violation using message='Arbetsplatser behöver unika identifierare.'; end if;
  ids:=array_append(ids,lower(p->>'id'));
  if exists(select 1 from jsonb_object_keys(p) k where k not in ('id','name','address','postal_code','city','longitude','latitude')) then
   raise check_violation using message='Okända arbetsplatsfält.'; end if;
  if jsonb_typeof(p->'name') is distinct from 'string' or length(trim(p->>'name')) not between 1 and 100
    or jsonb_typeof(p->'address') is distinct from 'string' or length(trim(p->>'address')) not between 1 and 250
    or jsonb_typeof(p->'postal_code') is distinct from 'string' or length(trim(p->>'postal_code')) not between 1 and 20
    or jsonb_typeof(p->'city') is distinct from 'string' or length(trim(p->>'city')) not between 1 and 100 then
   raise check_violation using message='Fyll i namn, adress, postnummer och ort för varje arbetsplats.';
  end if;
  if coalesce(p->'longitude','null'::jsonb)<>'null'::jsonb or coalesce(p->'latitude','null'::jsonb)<>'null'::jsonb then
   if jsonb_typeof(p->'longitude') is distinct from 'number' or jsonb_typeof(p->'latitude') is distinct from 'number' then
    raise check_violation using message='Ogiltiga koordinater.'; end if;
   lon:=(p->>'longitude')::numeric; lat:=(p->>'latitude')::numeric;
   if lon not between -180 and 180 or lat not between -90 and 90 then raise check_violation using message='Ogiltiga koordinater.'; end if;
  end if;
 end loop;
 if tg_op='UPDATE' and jsonb_array_length(old.workplaces)>0 and jsonb_array_length(new.workplaces)=0 then
  raise check_violation using message='Behåll minst en arbetsplats.';
 end if;
 if jsonb_array_length(new.workplaces)>0 then
  first_place:=new.workplaces->0;
  new.address:=trim(first_place->>'address'); new.postal_code:=trim(first_place->>'postal_code'); new.city:=trim(first_place->>'city');
  new.longitude:=(first_place->>'longitude')::double precision; new.latitude:=(first_place->>'latitude')::double precision;
 end if;
 return new;
end $$;
revoke all on function public.validate_job_workplaces() from public, anon, authenticated;
create trigger jobs_validate_workplaces before insert or update on public.jobs
 for each row execute function public.validate_job_workplaces();

create table public.application_workplace_preferences (
 job_id uuid not null references public.jobs(id) on delete cascade,
 youth_user_id uuid not null references auth.users(id) on delete cascade,
 workplace_id uuid not null,
 workplace_snapshot jsonb not null,
 updated_at timestamptz not null default now(),
 primary key(job_id,youth_user_id)
);
create index application_workplace_preferences_youth_idx on public.application_workplace_preferences(youth_user_id);
alter table public.application_workplace_preferences enable row level security;
grant select,insert,update,delete on public.application_workplace_preferences to authenticated;
grant all on public.application_workplace_preferences to service_role;

create function public.snapshot_application_workplace()
returns trigger language plpgsql security invoker set search_path = public, pg_catalog as $$
begin
 if tg_op='UPDATE' and (new.job_id,new.youth_user_id) is distinct from (old.job_id,old.youth_user_id) then
  raise insufficient_privilege using message='Ansökans identitet får inte ändras.';
 end if;
 select place into new.workplace_snapshot from public.jobs job
 cross join lateral jsonb_array_elements(job.workplaces) place
 where job.id=new.job_id and (place->>'id')::uuid=new.workplace_id;
 if new.workplace_snapshot is null then raise check_violation using message='Välj en aktuell arbetsplats.'; end if;
 new.updated_at:=now();
 return new;
end $$;
revoke all on function public.snapshot_application_workplace() from public,anon,authenticated;
create trigger application_workplace_snapshot before insert or update on public.application_workplace_preferences
 for each row execute function public.snapshot_application_workplace();

create policy "workplace preferences youth read" on public.application_workplace_preferences for select to authenticated
 using (youth_user_id=(select auth.uid()));
create policy "workplace preferences company read" on public.application_workplace_preferences for select to authenticated
 using (public.is_verified_company() and exists(select 1 from public.jobs j where j.id=job_id and j.company_user_id=(select auth.uid())
 and not public.users_are_blocked((select auth.uid()),youth_user_id))
 and exists(select 1 from public.swipe_actions s where s.job_id=application_workplace_preferences.job_id and s.youth_user_id=application_workplace_preferences.youth_user_id and s.decision='interested'));
create policy "workplace preferences youth insert" on public.application_workplace_preferences for insert to authenticated
 with check (youth_user_id=(select auth.uid())
 and exists(select 1 from public.profiles p where p.id=(select auth.uid()) and p.role='youth')
 and exists(select 1 from public.jobs j where j.id=job_id and j.status='active' and j.is_active and j.publication_status='published' and not public.users_are_blocked((select auth.uid()),j.company_user_id))
 and (exists(select 1 from public.swipe_actions s where s.job_id=application_workplace_preferences.job_id and s.youth_user_id=(select auth.uid()) and s.decision='interested')
 or exists(select 1 from public.youth_application_drafts d where d.job_id=application_workplace_preferences.job_id and d.youth_user_id=(select auth.uid()))));
create policy "workplace preferences youth update" on public.application_workplace_preferences for update to authenticated
 using (youth_user_id=(select auth.uid()))
 with check (youth_user_id=(select auth.uid())
 and exists(select 1 from public.jobs j where j.id=job_id and j.status='active' and j.is_active and j.publication_status='published' and not public.users_are_blocked((select auth.uid()),j.company_user_id))
 and (exists(select 1 from public.swipe_actions s where s.job_id=application_workplace_preferences.job_id and s.youth_user_id=(select auth.uid()) and s.decision='interested')
 or exists(select 1 from public.youth_application_drafts d where d.job_id=application_workplace_preferences.job_id and d.youth_user_id=(select auth.uid()))));
create policy "workplace preferences youth delete" on public.application_workplace_preferences for delete to authenticated
 using (youth_user_id=(select auth.uid()));
