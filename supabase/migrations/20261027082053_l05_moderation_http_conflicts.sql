-- Business conflicts must not use serialization_failure: PostgREST 14 retries
-- SQLSTATE 40001 indefinitely. PT409 returns an ordinary HTTP conflict.
-- https://supabase.com/docs/guides/troubleshooting/high-cpu-and-infinite-transaction-retries-when-using-custom-error-codes-in-rpc-functions-77326b
-- Keep the legacy endpoint safe for already-open clients.
create or replace function public.review_moderation_report(
 p_report_id uuid,p_status text,p_resolution_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.moderation_reports; note text:=nullif(btrim(p_resolution_note),'');
begin
 if not public.is_admin_account() then raise exception 'Admin access required' using errcode='42501'; end if;
 if p_status is null or p_status not in('reviewing','resolved','dismissed') or char_length(coalesce(note,''))>2000 then
  raise exception 'Invalid moderation decision' using errcode='22023'; end if;
 select * into r from public.moderation_reports where id=p_report_id for update;
 if not found then raise exception 'Report not found' using errcode='P0002'; end if;
 -- Identical retry leaves the original decision, reviewer, timestamp and notification intact.
 if r.status=p_status and r.resolution_note is not distinct from note then return; end if;
 if r.status in('resolved','dismissed') then
  raise exception 'Ärendet är redan avslutat. Läs om listan för att se beslutet.' using errcode='PT409'; end if;
 update public.moderation_reports set status=p_status,
  reviewed_at=case when p_status in('resolved','dismissed') then statement_timestamp() else null end,
  reviewed_by_user_id=auth.uid(),resolution_note=note where id=r.id;
 if p_status in('resolved','dismissed') and r.reporter_user_id is not null then
  insert into public.notifications(user_id,type,title,body,href) values(r.reporter_user_id,
   'moderation_report','Din anmälan har granskats',
   case when p_status='resolved' then 'Vi har granskat din anmälan och vidtagit lämpliga åtgärder.'
        else 'Vi har granskat din anmälan och avslutat ärendet.' end,'/notifications');
 end if;
end; $$;
revoke all on function public.review_moderation_report(uuid,text,text) from public,anon;
grant execute on function public.review_moderation_report(uuid,text,text) to authenticated,service_role;

-- Optimistic status check for the new UI, with the same row lock as the legacy path.
create or replace function public.review_moderation_report_checked(
 p_report_id uuid,p_status text,p_expected_status text,p_resolution_note text default null)
returns void language plpgsql security definer set search_path='' as $$
declare r public.moderation_reports; note text:=nullif(btrim(p_resolution_note),'');
begin
 if not public.is_admin_account() then raise exception 'Admin access required' using errcode='42501'; end if;
 select * into r from public.moderation_reports where id=p_report_id for update;
 if not found then raise exception 'Report not found' using errcode='P0002'; end if;
 if r.status=p_status and r.resolution_note is not distinct from note then return; end if;
 if p_expected_status is null or r.status is distinct from p_expected_status then
  raise exception 'Ärendet har ändrats. Läs det senaste beslutet innan du fortsätter.' using errcode='PT409'; end if;
 perform public.review_moderation_report(p_report_id,p_status,p_resolution_note);
end; $$;
revoke all on function public.review_moderation_report_checked(uuid,text,text,text) from public,anon;
grant execute on function public.review_moderation_report_checked(uuid,text,text,text) to authenticated,service_role;

