-- Allow replies to automatic recruitment followups and guard future rewards.
create function private.guard_recruitment_reward() returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.status in ('available','redeemed') and not exists(select 1 from public.employment_records e where e.match_id=new.match_id and e.company_user_id=new.company_user_id and e.response='approved' and e.paid_at is not null) then
    raise exception 'Belöningen kräver en bekräftad och betald rekrytering.' using errcode='22023'; end if;
  if new.status='redeemed' and (new.redeemed_at is null or new.expires_at is null or new.expires_at<=new.redeemed_at) then
    raise exception 'Rabatten är utgången eller saknar inlösendatum.' using errcode='22023'; end if;
  return new;
end; $$;
revoke all on function private.guard_recruitment_reward() from public,anon,authenticated;
create trigger rewards_require_paid_hire before insert or update on public.recruitment_rewards for each row execute function private.guard_recruitment_reward();
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
    insert into public.recruitment_audit(actor_user_id,match_id,action) values(caller,m.id,p_action);
    return jsonb_build_object('ok',true);
  elsif p_action='company_reply' then
    if caller<>m.company_user_id then raise exception 'Företagsåtkomst krävs.' using errcode='42501'; end if;
    if not exists(select 1 from public.recruitment_followups where match_id=m.id and (requested_at is not null or reminder_sent_at is not null) and review_state in ('open','reviewing')) then raise exception 'Ingen obesvarad påminnelse finns.' using errcode='22023'; end if;
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
create or replace function private.get_recruitment_records()
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
    'requested_at',f.requested_at,'reminder_sent_at',f.reminder_sent_at,'reported_at',case when admin or caller=m.youth_user_id then f.reported_at else null end,
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
