-- N24: immutable, job-specific employer questions in the existing retained followup store.
alter table public.application_followups
 add column question_source text not null default 'automatic' check(question_source in ('automatic','company')),
 add column asked_by uuid references auth.users(id) on delete cascade,
 add column request_key uuid,
 add constraint company_question_fields check(question_source<>'company' or (asked_by is not null and request_key is not null and char_length(question) between 1 and 500));
create unique index company_question_request on public.application_followups(job_id,youth_user_id,request_key) where question_source='company';
create index company_question_rate on public.application_followups(asked_by,created_at) where question_source='company';

create function private.application_question_open(p_job uuid,p_youth uuid)
returns boolean language sql stable security definer set search_path='' as $$
 select private.can_access_application_followups(p_job,p_youth)
 and exists(select 1 from public.application_completions a join public.jobs j on j.id=a.job_id
  where a.job_id=p_job and a.youth_user_id=p_youth and a.status='submitted' and j.status in ('active','paused'))
 and not exists(select 1 from private.application_retention r where r.job_id=p_job and r.youth_user_id=p_youth);
$$;
revoke all on function private.application_question_open(uuid,uuid) from public,anon;
grant execute on function private.application_question_open(uuid,uuid) to authenticated;

create function private.create_company_application_question(p_job_id uuid,p_youth_user_id uuid,p_question text,p_request_key uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); j public.jobs%rowtype; f public.application_followups%rowtype;
 q text:=btrim(p_question); normalized text; n integer; version integer;
begin
 if caller is null or not exists(select 1 from public.profiles where id=caller and role='company') then raise exception 'Company required' using errcode='42501'; end if;
 if q is null or char_length(q) not between 1 and 500 or p_request_key is null then raise exception 'Frågan får innehålla 1–500 tecken.' using errcode='22023'; end if;
 -- Company rate check and application lifecycle writes use shared transaction locks.
 perform pg_advisory_xact_lock(hashtextextended('n24-company:'||caller::text,0));
 perform pg_advisory_xact_lock(hashtextextended(p_youth_user_id::text||':'||p_job_id::text,0));
 begin
  select * into j from public.jobs where id=p_job_id for share nowait;
 exception when lock_not_available then raise exception 'Annonsen ändras. Läs om och försök igen.' using errcode='PT409'; end;
 if not found or j.company_user_id<>caller or not public.is_verified_company() or not private.application_question_open(p_job_id,p_youth_user_id)
  or j.status<>'active' or not j.is_active or j.publication_status<>'published'
  or exists(select 1 from public.company_interest_actions where job_id=p_job_id and youth_user_id=p_youth_user_id and decision='skip')
 then raise exception 'Ansökan tar inte emot nya frågor.' using errcode='42501'; end if;
 select * into f from public.application_followups where job_id=p_job_id and youth_user_id=p_youth_user_id and request_key=p_request_key and question_source='company';
 if found then
  if f.question<>q or f.asked_by<>caller then raise exception 'Begäran har ändrats. Läs om ansökan.' using errcode='PT409'; end if;
  return to_jsonb(f);
 end if;
 normalized:=lower(regexp_replace(q,'\s+',' ','g'));
 if exists(select 1 from public.application_followups where job_id=p_job_id and youth_user_id=p_youth_user_id and lower(regexp_replace(btrim(question),'\s+',' ','g'))=normalized)
  or exists(select 1 from public.application_completions a cross join lateral jsonb_array_elements(a.questions) item
   where a.job_id=p_job_id and a.youth_user_id=p_youth_user_id and lower(regexp_replace(btrim(item->>'question'),'\s+',' ','g'))=normalized)
 then raise exception 'Frågan finns redan i ansökan.' using errcode='PT409'; end if;
 select count(*) into n from public.application_followups where job_id=p_job_id and youth_user_id=p_youth_user_id and question_source='company' and status='pending';
 if n>=2 then raise exception 'Invänta svar på de två obesvarade frågorna.' using errcode='PT409'; end if;
 select count(*) into n from public.application_followups where job_id=p_job_id and youth_user_id=p_youth_user_id and question_source='company';
 if n>=5 then raise exception 'Högst fem egna frågor per ansökan.' using errcode='PT409'; end if;
 if exists(select 1 from public.application_followups where job_id=p_job_id and youth_user_id=p_youth_user_id and question_source='company' and created_at>statement_timestamp()-interval '60 seconds')
 then raise exception 'Vänta en minut innan du skickar en ny fråga.' using errcode='PT409'; end if;
 select count(*) into n from public.application_followups where asked_by=caller and question_source='company' and created_at>statement_timestamp()-interval '24 hours';
 if n>=20 then raise exception 'Gränsen för frågor det senaste dygnet är nådd.' using errcode='PT409'; end if;
 select profile_version into version from public.job_match_profiles where job_id=p_job_id;
 insert into public.application_followups(job_id,youth_user_id,criterion_key,criterion_label,question,job_profile_version,question_source,asked_by,request_key)
 values(p_job_id,p_youth_user_id,'company:'||md5(normalized),'Fråga från företaget',q,coalesce(version,1),'company',caller,p_request_key) returning * into f;
 insert into public.notifications(user_id,type,title,body,href)
 values(p_youth_user_id,'application_update','Fråga från företaget','Du har fått en frivillig fråga om din ansökan till '||j.title||'.','/applications?job='||p_job_id::text);
 return to_jsonb(f);
end; $$;
revoke all on function private.create_company_application_question(uuid,uuid,text,uuid) from public,anon;
grant execute on function private.create_company_application_question(uuid,uuid,text,uuid) to authenticated;
create function public.create_company_application_question(p_job_id uuid,p_youth_user_id uuid,p_question text,p_request_key uuid)
returns jsonb language sql security invoker set search_path='' as $$select private.create_company_application_question(p_job_id,p_youth_user_id,p_question,p_request_key);$$;
revoke all on function public.create_company_application_question(uuid,uuid,text,uuid) from public,anon;
grant execute on function public.create_company_application_question(uuid,uuid,text,uuid) to authenticated;

create function private.guard_company_question_update()
returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.question_source='company' then
  if row(new.id,new.job_id,new.youth_user_id,new.question_source,new.asked_by,new.request_key,new.question,new.criterion_key,new.criterion_label,new.created_at,new.job_profile_version)
   is distinct from row(old.id,old.job_id,old.youth_user_id,old.question_source,old.asked_by,old.request_key,old.question,old.criterion_key,old.criterion_label,old.created_at,old.job_profile_version)
  then raise exception 'Skickade frågor kan inte skrivas om.' using errcode='PT409'; end if;
  if row(new.status,new.answer,new.answered_at) is distinct from row(old.status,old.answer,old.answered_at) then
   if auth.uid() is distinct from old.youth_user_id or not private.application_question_open(old.job_id,old.youth_user_id)
   then raise exception 'Ansökan tar inte emot svar.' using errcode='42501'; end if;
  end if;
 elsif new.question_source is distinct from old.question_source then raise exception 'Question source is immutable' using errcode='42501';
 end if;
 return new;
end; $$;
revoke all on function private.guard_company_question_update() from public,anon,authenticated;
create trigger n24_question_immutable before update on public.application_followups for each row execute function private.guard_company_question_update();

alter table public.moderation_reports drop constraint moderation_reports_target_type_check;
alter table public.moderation_reports add constraint moderation_reports_target_type_check check(target_type in ('job','conversation','message','user','application_question'));
create function private.report_application_question(p_question_id uuid,p_reason text,p_details text default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare caller uuid:=auth.uid(); f public.application_followups%rowtype; report uuid; title text;
begin
 if caller is null then raise exception 'Authentication required' using errcode='42501'; end if;
 if p_reason is null or p_reason not in ('scam','harassment','discrimination','inappropriate','privacy','other') or char_length(coalesce(p_details,''))>2000
 then raise exception 'Invalid report' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(caller::text||':application_question:'||p_question_id::text,0));
 select * into f from public.application_followups where id=p_question_id and question_source='company' and youth_user_id=caller;
 if not found or not private.application_content_available(f.job_id,caller) then raise exception 'Question access required' using errcode='42501'; end if;
 select id into report from public.moderation_reports where reporter_user_id=caller and target_type='application_question' and target_id=f.id and status in ('open','reviewing') limit 1;
 if report is not null then return report; end if;
 select j.title into title from public.jobs j where j.id=f.job_id;
 insert into public.moderation_reports(reporter_user_id,target_type,target_id,reason,details,target_snapshot)
 values(caller,'application_question',f.id,p_reason,nullif(btrim(p_details),''),jsonb_build_object('title','Kompletteringsfråga: '||coalesce(title,''),'question',f.question,'asked_by',f.asked_by,'job_id',f.job_id,'created_at',f.created_at)) returning id into report;
 return report;
end; $$;
revoke all on function private.report_application_question(uuid,text,text) from public,anon;
grant execute on function private.report_application_question(uuid,text,text) to authenticated;
create function public.report_application_question(p_question_id uuid,p_reason text,p_details text default null)
returns uuid language sql security invoker set search_path='' as $$select private.report_application_question(p_question_id,p_reason,p_details);$$;
revoke all on function public.report_application_question(uuid,text,text) from public,anon;
grant execute on function public.report_application_question(uuid,text,text) to authenticated;
