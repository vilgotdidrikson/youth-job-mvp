-- Employer-authored employment facts are separate from CV text and billing.
create table public.employment_records (
  match_id uuid primary key references public.matches(id) on delete cascade,
  youth_user_id uuid not null references auth.users(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  company_name text not null,
  role_name text not null check (length(btrim(role_name)) between 1 and 120),
  start_date date not null,
  response text not null default 'pending' check (response in ('pending','approved','disputed')),
  approved_at timestamptz,
  show_on_profile boolean not null default false,
  include_in_cv boolean not null default false,
  registered_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  check (response = 'approved' or (not show_on_profile and not include_in_cv and approved_at is null))
);
create index employment_youth_idx on public.employment_records(youth_user_id);
create index employment_company_idx on public.employment_records(company_user_id);
alter table public.employment_records enable row level security;
create policy employment_read on public.employment_records for select to authenticated
  using (youth_user_id=(select auth.uid()) or company_user_id=(select auth.uid()) or (select public.is_admin_account()));
revoke all on public.employment_records from anon,authenticated;
grant select on public.employment_records to authenticated;
grant all on public.employment_records to service_role;

create table public.recruitment_followups (
  match_id uuid primary key references public.matches(id) on delete cascade,
  requested_at timestamptz,
  reported_at timestamptz,
  report_details text not null default '' check (length(report_details)<=2000),
  review_state text not null default 'open' check (review_state in ('open','reviewing','resolved','dismissed')),
  admin_notes text not null default '' check (length(admin_notes)<=3000),
  reviewed_by uuid references auth.users(id) on delete set null,
  reviewed_at timestamptz,
  reminder_sent_at timestamptz,
  escalated_at timestamptz
);
alter table public.recruitment_followups enable row level security;
create policy recruitment_followups_admin_read on public.recruitment_followups for select to authenticated using ((select public.is_admin_account()));
revoke all on public.recruitment_followups from anon,authenticated;
grant select on public.recruitment_followups to authenticated;
grant all on public.recruitment_followups to service_role;

create table public.company_recruitment_controls (
  company_user_id uuid primary key references auth.users(id) on delete cascade,
  restriction text not null default 'none' check (restriction in ('none','limited','suspended')),
  reason text not null default '' check (length(reason)<=2000),
  changed_at timestamptz not null default now(),
  changed_by uuid references auth.users(id) on delete set null
);
alter table public.company_recruitment_controls enable row level security;
create policy recruitment_controls_read on public.company_recruitment_controls for select to authenticated
  using (company_user_id=(select auth.uid()) or (select public.is_admin_account()));
revoke all on public.company_recruitment_controls from anon,authenticated;
grant select on public.company_recruitment_controls to authenticated;
grant all on public.company_recruitment_controls to service_role;

create table public.recruitment_outcomes (
  job_id uuid primary key references public.jobs(id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  outcome text not null check (outcome in ('hired','no_hire','continuing')),
  recorded_at timestamptz not null default now()
);
alter table public.recruitment_outcomes enable row level security;
create policy recruitment_outcomes_read on public.recruitment_outcomes for select to authenticated
  using (company_user_id=(select auth.uid()) or (select public.is_admin_account()));
revoke all on public.recruitment_outcomes from anon,authenticated;
grant select on public.recruitment_outcomes to authenticated;
grant all on public.recruitment_outcomes to service_role;

-- Dormant billing integration; no discount offer or redemption is enabled.
create table public.recruitment_rewards (
  match_id uuid primary key references public.employment_records(match_id) on delete cascade,
  company_user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'disabled' check (status in ('disabled','awaiting_payment','available','redeemed','cancelled')),
  discount_percent integer check (discount_percent between 1 and 100),
  expires_at timestamptz,
  redeemed_at timestamptz,
  check (status in ('disabled','cancelled') or discount_percent is not null)
);
alter table public.recruitment_rewards enable row level security;
create policy recruitment_rewards_read on public.recruitment_rewards for select to authenticated
  using (company_user_id=(select auth.uid()) or (select public.is_admin_account()));
revoke all on public.recruitment_rewards from anon,authenticated;
grant select on public.recruitment_rewards to authenticated;
grant all on public.recruitment_rewards to service_role;

create table public.recruitment_audit (
  id bigint generated always as identity primary key,
  actor_user_id uuid references auth.users(id) on delete set null,
  match_id uuid references public.matches(id) on delete set null,
  action text not null,
  details jsonb not null default '{}',
  created_at timestamptz not null default now()
);
alter table public.recruitment_audit enable row level security;
create policy recruitment_audit_read on public.recruitment_audit for select to authenticated using ((select public.is_admin_account()));
revoke all on public.recruitment_audit from anon,authenticated;
grant select on public.recruitment_audit to authenticated;
grant all on public.recruitment_audit to service_role;

create or replace function private.recruitment_action(p_action text,p_match_id uuid,p_payload jsonb default '{}')
returns jsonb language plpgsql security definer set search_path='' as $$
declare
  caller uuid:=auth.uid(); m public.matches%rowtype; e public.employment_records%rowtype;
  f public.recruitment_followups%rowtype; j public.jobs%rowtype; target uuid;
  admin boolean; role_value text; date_value date; response_value text; reason text; outcome_value text;
begin
  if caller is null then raise exception 'Logga in för att fortsätta.' using errcode='42501'; end if;
  if p_payload is null or jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>12000 then
    raise exception 'Ogiltiga uppgifter.' using errcode='22023'; end if;
  admin:=public.is_admin_account();
  if p_action='restrict' then
    if not admin then raise exception 'Endast admin kan begränsa rekrytering.' using errcode='42501'; end if;
    target:=(p_payload->>'company_user_id')::uuid; reason:=btrim(coalesce(p_payload->>'reason',''));
    if target is null or not public.is_company_account(target) or coalesce(p_payload->>'restriction','') not in ('none','limited','suspended')
      or length(reason) not between 10 and 2000 or coalesce(p_payload->>'review_confirmed','')<>'true' then
      raise exception 'Ange skäl och bekräfta att ärendet har följts upp.' using errcode='22023'; end if;
    insert into public.company_recruitment_controls(company_user_id,restriction,reason,changed_by)
      values(target,p_payload->>'restriction',reason,caller)
      on conflict(company_user_id) do update set restriction=excluded.restriction,reason=excluded.reason,changed_by=caller,changed_at=now();
    insert into public.recruitment_audit(actor_user_id,action,details) values(caller,'restriction',p_payload);
    insert into public.notifications(user_id,type,title,body,href) values(target,'recruitment','Rekryteringsbehörighet uppdaterad',
      case when p_payload->>'restriction'='none' then 'Du kan åter publicera annonser och öppna nya kandidatkontakter.'
      else 'Nya annonser och kandidatkontakter är pausade. Befintliga chattar finns kvar. Skäl: '||reason end,'/company?view=annonser');
    return jsonb_build_object('ok',true);
  elsif p_action='close_job' then
    select * into j from public.jobs where id=(p_payload->>'job_id')::uuid and company_user_id=caller for update;
    if not found or not public.is_company_account() then raise exception 'Annonsen tillhör inte ditt företag.' using errcode='42501'; end if;
    outcome_value:=p_payload->>'outcome';
    if outcome_value is null or outcome_value not in ('hired','no_hire','continuing') then raise exception 'Välj hur rekryteringen gick.' using errcode='22023'; end if;
    if outcome_value='hired' and not exists(select 1 from public.employment_records er join public.matches ma on ma.id=er.match_id where ma.job_id=j.id) then
      raise exception 'Registrera den anställda kandidaten i chatten först.' using errcode='22023'; end if;
    if outcome_value='no_hire' and exists(select 1 from public.matches where job_id=j.id and status='hired') then
      raise exception 'En anställning är redan registrerad för annonsen.' using errcode='22023'; end if;
    insert into public.recruitment_outcomes(job_id,company_user_id,outcome) values(j.id,caller,outcome_value)
      on conflict(job_id) do update set outcome=excluded.outcome,recorded_at=now();
    update public.jobs set status='closed' where id=j.id;
    insert into public.recruitment_audit(actor_user_id,action,details) values(caller,'close_job',p_payload);
    return jsonb_build_object('ok',true);
  end if;
  select * into m from public.matches where id=p_match_id for update;
  if not found or (caller<>m.youth_user_id and caller<>m.company_user_id and not admin) then
    raise exception 'Du saknar åtkomst till rekryteringen.' using errcode='42501'; end if;
  select * into e from public.employment_records where match_id=m.id for update;
  if p_action='register' then
    if caller<>m.company_user_id or not public.is_verified_company() or m.status not in ('matched','in_contact','interview','hired')
      or not exists(select 1 from public.jobs where id=m.job_id and company_user_id=caller)
      or not exists(select 1 from public.conversations where match_id=m.id and company_user_id=caller and youth_user_id=m.youth_user_id)
      or public.users_are_blocked(caller,m.youth_user_id) then
      raise exception 'Endast det verifierade företaget kan registrera anställningen.' using errcode='42501'; end if;
    if e.response='approved' then raise exception 'Anställningen är redan godkänd. Kontakta admin för rättelse.' using errcode='22023'; end if;
    role_value:=btrim(coalesce(p_payload->>'role_name','')); date_value:=(p_payload->>'start_date')::date;
    if length(role_value) not between 1 and 120 or date_value is null or date_value<date '2000-01-01' or date_value>current_date+730 then
      raise exception 'Ange befattning och ett giltigt startdatum.' using errcode='22023'; end if;
    if e.match_id is not null and e.role_name=role_value and e.start_date=date_value and e.response='pending' then return to_jsonb(e); end if;
    insert into public.employment_records(match_id,youth_user_id,company_user_id,company_name,role_name,start_date)
      select m.id,m.youth_user_id,caller,coalesce(nullif(cp.company_name,''),'Företag'),role_value,date_value
      from public.company_profiles cp where cp.user_id=caller
      on conflict(match_id) do update set role_name=excluded.role_name,start_date=excluded.start_date,response='pending',
        approved_at=null,show_on_profile=false,include_in_cv=false,registered_at=now(),updated_at=now()
      returning * into e;
    if e.match_id is null then raise exception 'Företagsprofil saknas.' using errcode='22023'; end if;
    update public.matches set status='hired',hire_completed_at=coalesce(hire_completed_at,now()),hired_by_user_id=caller where id=m.id;
    insert into public.recruitment_rewards(match_id,company_user_id) values(m.id,caller) on conflict do nothing;
    insert into public.recruitment_followups(match_id) values(m.id)
      on conflict(match_id) do update set review_state='open',reminder_sent_at=null,escalated_at=null;
    insert into public.notifications(user_id,type,title,body,href) values(m.youth_user_id,'employment','Granska din anställning',
      e.company_name||' har registrerat dig som '||role_value||'. Granska uppgifterna och välj om erfarenheten ska visas på din profil och i ditt CV.',
      '/chats?job='||m.job_id::text);
  elsif p_action='respond' then
    if caller<>m.youth_user_id or e.match_id is null then raise exception 'Ingen anställning att granska.' using errcode='42501'; end if;
    response_value:=p_payload->>'response';
    if response_value is null or response_value not in ('approved','disputed') then raise exception 'Välj ett svar.' using errcode='22023'; end if;
    update public.employment_records set response=response_value,
      approved_at=case when response_value='approved' then coalesce(approved_at,now()) else null end,
      show_on_profile=case when response_value='approved' then coalesce((p_payload->>'show_on_profile')::boolean,false) else false end,
      include_in_cv=case when response_value='approved' then coalesce((p_payload->>'include_in_cv')::boolean,false) else false end,
      updated_at=now() where match_id=m.id returning * into e;
    -- A generated PDF is a snapshot. Rebuild it after visibility changes.
    update public.youth_profiles set documents=coalesce((select jsonb_agg(doc) from jsonb_array_elements(coalesce(documents,'[]'::jsonb)) doc where doc->>'type'<>'generated_cv'),'[]'::jsonb)
      where user_id=caller;
    if response_value='disputed' then
      insert into public.recruitment_followups(match_id,reported_at,report_details) values(m.id,now(),'Ungdomen vill rätta anställningsuppgifterna.')
        on conflict(match_id) do update set reported_at=now(),review_state='open',report_details=excluded.report_details,escalated_at=now();
    end if;
    if response_value is distinct from (select action from public.recruitment_audit where match_id=m.id and action in ('approved','disputed') order by created_at desc limit 1) then
      insert into public.notifications(user_id,type,title,body,href) values(m.company_user_id,'employment',
        case when response_value='approved' then 'Anställningen är godkänd' else 'Anställningsuppgifter behöver rättas' end,
        case when response_value='approved' then 'Kandidaten har godkänt anställningsuppgifterna.' else 'Kandidaten har invänt mot uppgifterna. Kontrollera befattning och startdatum tillsammans.' end,'/chats?job='||m.job_id::text);
    end if;
    p_action:=response_value;
  elsif p_action in ('request','report') then
    if caller<>m.youth_user_id or m.status not in ('matched','in_contact','interview','hired') then raise exception 'Du kan bara följa upp din egen matchning.' using errcode='42501'; end if;
    if e.match_id is not null then raise exception 'Anställningen är redan registrerad. Granska uppgifterna i stället.' using errcode='22023'; end if;
    if public.users_are_blocked(caller,m.company_user_id) then raise exception 'Kontakten är blockerad. Använd den vanliga anmälningsfunktionen.' using errcode='42501'; end if;
    insert into public.recruitment_followups(match_id) values(m.id) on conflict do nothing;
    select * into f from public.recruitment_followups where match_id=m.id for update;
    if p_action='request' then
      if f.requested_at>now()-interval '7 days' then raise exception 'En påminnelse är redan skickad. Du kan påminna igen efter sju dagar.' using errcode='22023'; end if;
      update public.recruitment_followups set requested_at=now(),reminder_sent_at=null,escalated_at=null,review_state='open' where match_id=m.id;
      insert into public.notifications(user_id,type,title,body,href) values(m.company_user_id,'employment','Registrera anställningen om rekryteringen är klar',
        'En kandidat ber dig registrera anställningen. Om ni inte kommit överens om ett jobb kan du ange att rekryteringen fortfarande pågår.', '/chats?job='||m.job_id::text);
    else
      reason:=btrim(coalesce(p_payload->>'details',''));
      if length(reason) not between 10 and 2000 then raise exception 'Beskriv kort vad som hänt (10–2000 tecken).' using errcode='22023'; end if;
      if f.reported_at is not null and f.review_state in ('open','reviewing') then raise exception 'Admin har redan fått ditt ärende.' using errcode='22023'; end if;
      update public.recruitment_followups set reported_at=now(),report_details=reason,review_state='open',escalated_at=now() where match_id=m.id;
      -- No status change, bill, public badge or automatic restriction.
    end if;
    return jsonb_build_object('ok',true);
  elsif p_action='company_reply' then
    if caller<>m.company_user_id then raise exception 'Företagsåtkomst krävs.' using errcode='42501'; end if;
    if coalesce(p_payload->>'reply','') not in ('ongoing','no_hire') then raise exception 'Välj ett svar.' using errcode='22023'; end if;
    update public.recruitment_followups set review_state=case when reported_at is null then 'resolved' else review_state end where match_id=m.id;
    insert into public.notifications(user_id,type,title,body,href) values(m.youth_user_id,'employment','Arbetsgivaren har svarat',
      case when p_payload->>'reply'='ongoing' then 'Arbetsgivaren uppger att rekryteringen fortfarande pågår.' else 'Arbetsgivaren uppger att ingen anställning har avtalats. Du kan kontakta admin om du har börjat arbeta.' end,'/chats?job='||m.job_id::text);
    insert into public.recruitment_audit(actor_user_id,match_id,action,details) values(caller,m.id,p_action,p_payload);
    return jsonb_build_object('ok',true);
  elsif p_action='review' then
    if not admin then raise exception 'Adminåtkomst krävs.' using errcode='42501'; end if;
    if coalesce(p_payload->>'state','') not in ('open','reviewing','resolved','dismissed') or length(coalesce(p_payload->>'notes',''))>3000 then raise exception 'Ogiltig granskning.' using errcode='22023'; end if;
    insert into public.recruitment_followups(match_id,review_state,admin_notes,reviewed_by,reviewed_at)
      values(m.id,p_payload->>'state',coalesce(p_payload->>'notes',''),caller,now())
      on conflict(match_id) do update set review_state=excluded.review_state,admin_notes=excluded.admin_notes,reviewed_by=caller,reviewed_at=now();
    insert into public.recruitment_audit(actor_user_id,match_id,action,details) values(caller,m.id,p_action,p_payload);
    return jsonb_build_object('ok',true);
  else raise exception 'Okänd åtgärd.' using errcode='22023';
  end if;
  insert into public.recruitment_audit(actor_user_id,match_id,action) values(caller,m.id,p_action);
  return to_jsonb(e);
end; $$;
revoke all on function private.recruitment_action(text,uuid,jsonb) from public,anon;
grant usage on schema private to authenticated;
grant execute on function private.recruitment_action(text,uuid,jsonb) to authenticated;
create function public.recruitment_action(p_action text,p_match_id uuid default null,p_payload jsonb default '{}')
returns jsonb language sql security invoker set search_path='' as $$ select private.recruitment_action(p_action,p_match_id,p_payload); $$;
revoke all on function public.recruitment_action(text,uuid,jsonb) from public,anon;
grant execute on function public.recruitment_action(text,uuid,jsonb) to authenticated;

create function private.get_recruitment_records()
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); admin boolean;
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  admin:=public.is_admin_account();
  return coalesce((select jsonb_agg(jsonb_build_object(
    'match_id',m.id,'job_id',m.job_id,'match_status',m.status,'job_title',j.title,
    'company_user_id',m.company_user_id,'youth_user_id',m.youth_user_id,
    'company_name',coalesce(e.company_name,cp.company_name,j.company_name,'Företag'),
    'youth_name',coalesce(y.full_name,'Kandidat'),'employment',to_jsonb(e),
    'requested_at',f.requested_at,'reported_at',case when admin or caller=m.youth_user_id then f.reported_at else null end,
    'review_state',f.review_state,'report_details',case when admin or caller=m.youth_user_id then f.report_details else null end,
    'admin_notes',case when admin then f.admin_notes else null end,'escalated_at',case when admin then f.escalated_at else null end,
    'restriction',coalesce(c.restriction,'none'),'restriction_reason',case when admin or caller=m.company_user_id then c.reason else null end,
    'created_at',m.created_at) order by coalesce(e.registered_at,f.reported_at,f.requested_at,m.created_at) desc)
    from public.matches m join public.jobs j on j.id=m.job_id
    left join public.company_profiles cp on cp.user_id=m.company_user_id
    left join public.youth_profiles y on y.user_id=m.youth_user_id
    left join public.employment_records e on e.match_id=m.id
    left join public.recruitment_followups f on f.match_id=m.id
    left join public.company_recruitment_controls c on c.company_user_id=m.company_user_id
    where (admin or caller in (m.company_user_id,m.youth_user_id))
      and (admin or not public.users_are_blocked(m.company_user_id,m.youth_user_id))), '[]');
end; $$;
revoke all on function private.get_recruitment_records() from public,anon;
grant execute on function private.get_recruitment_records() to authenticated;
create function public.get_recruitment_records() returns jsonb language sql security invoker set search_path='' as $$ select private.get_recruitment_records(); $$;
revoke all on function public.get_recruitment_records() from public,anon;
grant execute on function public.get_recruitment_records() to authenticated;

-- Candidate-visible verification is derived from authoritative records only.
create function private.get_verified_experience(p_youth_user_id uuid,p_job_id uuid default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); own boolean;
begin
  if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
  own:=caller=p_youth_user_id;
  if not own and not public.is_admin_account() then
    perform public.get_candidate_assessment_input(p_job_id,p_youth_user_id);
  end if;
  return coalesce((select jsonb_agg(jsonb_build_object('match_id',match_id,'company_name',company_name,'role_name',role_name,
    'start_date',start_date,'show_on_profile',show_on_profile,'include_in_cv',include_in_cv) order by start_date desc)
    from public.employment_records where youth_user_id=p_youth_user_id and response='approved'
    and (own or public.is_admin_account() or show_on_profile or include_in_cv)), '[]');
end; $$;
revoke all on function private.get_verified_experience(uuid,uuid) from public,anon;
grant execute on function private.get_verified_experience(uuid,uuid) to authenticated;
create function public.get_verified_experience(p_youth_user_id uuid,p_job_id uuid default null)
returns jsonb language sql security invoker set search_path='' as $$ select private.get_verified_experience(p_youth_user_id,p_job_id); $$;
revoke all on function public.get_verified_experience(uuid,uuid) from public,anon;
grant execute on function public.get_verified_experience(uuid,uuid) to authenticated;

create function private.enforce_recruitment_controls() returns trigger language plpgsql security definer set search_path='' as $$
declare employer uuid;
begin
  employer:=new.company_user_id;
  if exists(select 1 from public.company_recruitment_controls where company_user_id=employer and restriction<>'none') then
    if tg_table_name='jobs' then
      if tg_op='INSERT' or (new.status='active' and old.status is distinct from 'active') then
        raise exception 'Nya annonser och kandidatkontakter är pausade. Se företagets rekryteringsstatus.' using errcode='42501'; end if;
    elsif tg_table_name='matches' then
      raise exception 'Nya kandidatkontakter är pausade. Befintliga chattar finns kvar.' using errcode='42501';
    elsif new.decision='interested' and (tg_op='INSERT' or old.decision is distinct from 'interested') then
      raise exception 'Nya kandidatkontakter är pausade. Befintliga chattar finns kvar.' using errcode='42501';
    end if;
  end if;
  return new;
end; $$;
revoke all on function private.enforce_recruitment_controls() from public,anon,authenticated;
create trigger jobs_recruitment_controls before insert or update on public.jobs for each row execute function private.enforce_recruitment_controls();
create trigger matches_recruitment_controls before insert on public.matches for each row execute function private.enforce_recruitment_controls();
create trigger interests_recruitment_controls before insert or update on public.company_interest_actions for each row execute function private.enforce_recruitment_controls();

-- Prevent direct close requests from bypassing the outcome prompt.
create function private.require_recruitment_outcome() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status='closed' and old.status is distinct from 'closed' and exists(select 1 from public.profiles where id=new.company_user_id and role='company')
    and not exists(select 1 from public.recruitment_outcomes where job_id=new.id) then
    raise exception 'Ange rekryteringsresultat innan annonsen stängs.' using errcode='22023'; end if;
  if new.status='active' and old.status='closed' then delete from public.recruitment_outcomes where job_id=new.id; end if;
  return new;
end; $$;
revoke all on function private.require_recruitment_outcome() from public,anon,authenticated;
create trigger jobs_require_recruitment_outcome before update of status on public.jobs for each row execute function private.require_recruitment_outcome();

create function private.process_recruitment_reminders() returns integer language plpgsql security definer set search_path='' as $$
declare row record; sent integer:=0;
begin
  perform pg_advisory_xact_lock(hashtextextended('mnw-recruitment-reminders',0));
  for row in select f.*,m.company_user_id,m.youth_user_id,m.job_id,e.registered_at,e.response
    from public.recruitment_followups f join public.matches m on m.id=f.match_id
    left join public.employment_records e on e.match_id=m.id
    where f.review_state in ('open','reviewing')
      and (e.response='pending' or (e.match_id is null and f.requested_at is not null))
      and not public.users_are_blocked(m.company_user_id,m.youth_user_id) for update of f
  loop
    if coalesce(row.registered_at,row.requested_at)<=now()-interval '3 days' and row.reminder_sent_at is null then
      insert into public.notifications(user_id,type,title,body,href) values(
        case when row.response='pending' then row.youth_user_id else row.company_user_id end,'employment','Påminnelse om anställning',
        case when row.response='pending' then 'Granska anställningsuppgifterna som arbetsgivaren har registrerat.' else 'En kandidat väntar på svar om registrering av en anställning. Ange hur rekryteringen går.' end,'/chats?job='||row.job_id::text);
      update public.recruitment_followups set reminder_sent_at=now() where match_id=row.match_id; sent:=sent+1;
    end if;
    if coalesce(row.registered_at,row.requested_at)<=now()-interval '7 days' and row.escalated_at is null then
      update public.recruitment_followups set escalated_at=now() where match_id=row.match_id;
    end if;
  end loop;
  return sent;
end; $$;
revoke all on function private.process_recruitment_reminders() from public,anon,authenticated;
grant execute on function private.process_recruitment_reminders() to service_role;
create extension if not exists pg_cron;
select cron.schedule('mnw-recruitment-reminders','17 * * * *','select private.process_recruitment_reminders()');

-- Legacy hires remain hires but receive no inferred dates or verification.
-- The employer supplies the missing employment facts through the new flow.
revoke execute on function public.mark_match_hired(uuid) from authenticated;
