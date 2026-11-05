-- Permanent application conflicts must return once, not enter PostgREST's
-- serialization-failure transaction retry loop. Keep all existing guards,
-- locks, signatures, function attributes and grants unchanged.
-- https://supabase.com/kb/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b

create or replace function private.save_my_application_disclosure(p_job_id uuid,p_selection text[],p_source_token text) returns jsonb language plpgsql security definer set search_path='' as $$
declare current_input jsonb;
begin
 perform public.get_my_application_disclosure_preview(p_job_id,p_selection);
 perform pg_advisory_xact_lock(hashtextextended(auth.uid()::text||':'||p_job_id::text,0));
 perform 1 from public.youth_profiles where user_id=auth.uid() for share;
 current_input:=private.build_application_disclosure(p_job_id,auth.uid(),p_selection);
 if p_source_token is distinct from current_input->>'source_token' then raise exception 'Profilen har ändrats. Läs förhandsvisningen igen.' using errcode='PT409'; end if;
 insert into private.application_disclosures(job_id,youth_user_id,selected_keys,source_token,packet,matching_input)
 values(p_job_id,auth.uid(),p_selection,p_source_token,current_input->'packet',current_input->'matching_input')
 on conflict(job_id,youth_user_id) do update set revision=application_disclosures.revision+1,selected_keys=excluded.selected_keys,source_token=excluded.source_token,packet=excluded.packet,matching_input=excluded.matching_input,updated_at=now();
 perform private.enqueue_application_analysis(p_job_id,auth.uid());
 return private.shared_application_packet(p_job_id,auth.uid());
end $$;

create or replace function private.snapshot_application_disclosure() returns trigger language plpgsql security definer set search_path='' as $$
declare input jsonb; existing private.application_disclosures;
begin
 if new.decision<>'interested' then return new; end if;
 if tg_op='UPDATE' and old.decision='interested' then return new; end if;
 select * into existing from private.application_disclosures where job_id=new.job_id and youth_user_id=new.youth_user_id;
 input:=private.build_application_disclosure(new.job_id,new.youth_user_id,coalesce(existing.selected_keys,'{}'));
 if existing.job_id is not null then
  if existing.source_token is distinct from input->>'source_token' then raise exception 'Profilen har ändrats. Läs ansökans förhandsvisning igen.' using errcode='PT409'; end if;
 else
  insert into private.application_disclosures(job_id,youth_user_id,source_token,packet,matching_input) values(new.job_id,new.youth_user_id,input->>'source_token',input->'packet',input->'matching_input');
 end if;
 return new;
end $$;
