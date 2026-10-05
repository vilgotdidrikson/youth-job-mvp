-- Short analysis leases prevent duplicate provider calls across concurrent requests.
alter table public.application_completions add column followup_pending_hash text,
 add column followup_analysis_started_at timestamptz;
create function public.claim_application_followup_analysis(p_job_id uuid,p_youth_user_id uuid,p_input_hash text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a public.application_completions%rowtype;
begin
 if not private.can_access_application_followups(p_job_id,p_youth_user_id) then raise exception 'Application access required' using errcode='42501'; end if;
 if p_input_hash is null or p_input_hash !~ '^[a-f0-9]{64}$' then raise exception 'Invalid analysis hash' using errcode='22023'; end if;
 perform pg_advisory_xact_lock(hashtextextended(p_youth_user_id::text||':'||p_job_id::text,0));
 select * into a from public.application_completions where job_id=p_job_id and youth_user_id=p_youth_user_id for update;
 if not found or a.status<>'submitted' then return jsonb_build_object('claimed',false,'reason','not_submitted'); end if;
 if a.followup_analysis_hash=p_input_hash then return jsonb_build_object('claimed',false,'reason','cached'); end if;
 if a.followup_analysis_started_at>now()-interval '90 seconds' then return jsonb_build_object('claimed',false,'reason','busy'); end if;
 update public.application_completions set followup_pending_hash=p_input_hash,followup_analysis_started_at=now() where job_id=p_job_id and youth_user_id=p_youth_user_id;
 return jsonb_build_object('claimed',true);
end; $$;
revoke all on function public.claim_application_followup_analysis(uuid,uuid,text) from public,anon;
grant execute on function public.claim_application_followup_analysis(uuid,uuid,text) to authenticated;
create function public.release_application_followup_analysis(p_job_id uuid,p_youth_user_id uuid,p_input_hash text)
returns void language plpgsql security definer set search_path='' as $$
begin
 if not private.can_access_application_followups(p_job_id,p_youth_user_id) then raise exception 'Application access required' using errcode='42501'; end if;
 update public.application_completions set followup_pending_hash=null,followup_analysis_started_at=null
 where job_id=p_job_id and youth_user_id=p_youth_user_id and followup_pending_hash=p_input_hash;
end; $$;
revoke all on function public.release_application_followup_analysis(uuid,uuid,text) from public,anon;
grant execute on function public.release_application_followup_analysis(uuid,uuid,text) to authenticated;
