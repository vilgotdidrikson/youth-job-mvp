-- L16: show the exact saved retention date only in the handler view.
create or replace function private.privacy_case_projection(p_id uuid,p_actor uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select jsonb_build_object('id',c.id,'requester_id',c.requester_id,'kind',c.kind,'body',c.body,'status',c.status,
 'revision',c.revision,'created_at',c.created_at,'updated_at',c.updated_at,'reply_due_at',c.reply_due_at,'closed_at',c.closed_at,
 'first_reply_at',case when p_actor is not null then (select min(coalesce(e.external_sent_at,e.created_at)) from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review')) and e.action in ('reply','waiting','close') and e.public_message is not null) else null end,
 'intake_source',c.intake_source,'contact_email',case when p_actor is not null then c.contact_email else null end,
 'review_after',case when p_actor is not null then c.review_after else null end,
 'retention_until',case when p_actor is not null then c.retention_until else null end,
 'assigned',c.assigned_to is not null,'is_mine',coalesce(c.assigned_to=p_actor,false),
 'events',coalesce((select jsonb_agg(e.item order by e.created_at,e.id) from
  (select e.id,e.created_at,jsonb_build_object('id',e.id,'action',e.action,'public_message',e.public_message,'created_at',e.created_at)||case when p_actor is not null then jsonb_build_object('review_after',e.review_after,'external_sent_at',e.external_sent_at) else '{}'::jsonb end item
   from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review')) order by e.created_at desc,e.id desc limit 20)e),'[]'::jsonb),
 'events_truncated',(select count(*)>20 from private.privacy_case_events e where e.case_id=c.id and (p_actor is not null or e.action not in ('review','schedule_review'))))
 from private.privacy_cases c where c.id=p_id and (c.intake_source='portal' or p_actor is not null);
$$;
