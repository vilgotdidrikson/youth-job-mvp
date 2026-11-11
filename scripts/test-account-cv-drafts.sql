-- DevStaging only, after migration. All new fixtures and RPC writes roll back.
begin;
insert into auth.users(id,email,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at) values
 ('e8abe85a-3441-4ce2-a7ab-cfb0e57dc168','qa-cv-draft-a@example.invalid','{"role":"youth"}','{}','authenticated','authenticated',now(),now()),
 ('965fb716-28fa-444e-a9bf-c2f104fd4415','qa-cv-draft-b@example.invalid','{"role":"youth"}','{}','authenticated','authenticated',now(),now()),
 ('ae603076-4295-47c4-a854-63c7f554f4d7','qa-cv-draft-company@example.invalid','{"role":"company"}','{}','authenticated','authenticated',now(),now());
select set_config('mnw.test.cv_draft',jsonb_build_object('version',1,'method','manual','step','about','draft',jsonb_build_object('about','QA arbetsutkast','school','','program','','graduation','','experience','','skills','','languages','','merits','','linkedin','','portfolio','','otherLink','','noExperience',false),'returnToReview',false,'editedSections','[]'::jsonb,'generated',null,'reviewSource','')::text,true);
set local role authenticated;
select set_config('request.jwt.claims','{"sub":"e8abe85a-3441-4ce2-a7ab-cfb0e57dc168","role":"authenticated","is_anonymous":false}',true);
do $$ declare r public.youth_cv_drafts%rowtype; old_revision uuid; initial_cv_text text; begin
 select cv_text into initial_cv_text from public.youth_profiles where user_id=auth.uid();
 if exists(select 1 from public.youth_cv_drafts) then raise exception 'unexpected visible fixture'; end if;
 select * into r from public.save_my_cv_draft(null,current_setting('mnw.test.cv_draft')::jsonb);
 if r.user_id<>'e8abe85a-3441-4ce2-a7ab-cfb0e57dc168'::uuid or r.content->>'method'<>'manual' then raise exception 'wrong owner/content'; end if;
 old_revision:=r.revision;
 if (select count(*) from public.youth_cv_drafts)<>1 then raise exception 'own read failed'; end if;
 begin perform public.save_my_cv_draft(null,r.content);raise exception 'stale create accepted';exception when sqlstate 'PT409' then null;end;
 select * into r from public.save_my_cv_draft(r.revision,jsonb_set(r.content,'{draft,about}','"QA nyare arbetsutkast"'));
 if r.revision=old_revision then raise exception 'revision unchanged'; end if;
 begin perform public.save_my_cv_draft(old_revision,r.content);raise exception 'stale update accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.save_my_cv_draft(r.revision,r.content||'{"approvedSnapshot":"must-not-persist"}');raise exception 'approval accepted';exception when invalid_parameter_value then null;end;
 begin perform public.save_my_cv_draft(r.revision,jsonb_set(r.content,'{method}','null'));raise exception 'null method accepted';exception when invalid_parameter_value then null;end;
 begin perform public.save_my_cv_draft(r.revision,jsonb_set(r.content,'{draft,about}',to_jsonb(repeat('x',12001))));raise exception 'oversize accepted';exception when invalid_parameter_value then null;end;
 begin insert into public.youth_cv_drafts(user_id,content)values('965fb716-28fa-444e-a9bf-c2f104fd4415',r.content);raise exception 'direct insert allowed';exception when insufficient_privilege then null;end;
 begin update public.youth_cv_drafts set content=null;raise exception 'direct update allowed';exception when insufficient_privilege then null;end;
 if has_table_privilege('authenticated','public.youth_cv_drafts','DELETE') then raise exception 'direct delete allowed';end if;
 perform set_config('mnw.test.old_revision',r.revision::text,true);
 select * into r from public.save_my_cv_draft(r.revision,null);
 if r.content is not null then raise exception 'clear failed'; end if;
 begin perform public.save_my_cv_draft(null,current_setting('mnw.test.cv_draft')::jsonb);raise exception 'stale recreate accepted';exception when sqlstate 'PT409' then null;end;
 begin perform public.save_my_cv_draft(current_setting('mnw.test.old_revision')::uuid,current_setting('mnw.test.cv_draft')::jsonb);raise exception 'stale clear token accepted';exception when sqlstate 'PT409' then null;end;
 select * into r from public.save_my_cv_draft(r.revision,current_setting('mnw.test.cv_draft')::jsonb);
 if r.content is null then raise exception 'resume after clear failed'; end if;
 if (select cv_text from public.youth_profiles where user_id=r.user_id) is distinct from initial_cv_text then raise exception 'draft leaked into CV'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"965fb716-28fa-444e-a9bf-c2f104fd4415","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.youth_cv_drafts) then raise exception 'other youth sees draft'; end if;
 perform public.save_my_cv_draft(null,current_setting('mnw.test.cv_draft')::jsonb);
 if (select count(*) from public.youth_cv_drafts)<>1 then raise exception 'second own draft missing'; end if;
end $$;
select set_config('request.jwt.claims','{"sub":"ae603076-4295-47c4-a854-63c7f554f4d7","role":"authenticated"}',true);
do $$ begin
 if exists(select 1 from public.youth_cv_drafts) then raise exception 'company sees draft'; end if;
 begin perform public.save_my_cv_draft(null,current_setting('mnw.test.cv_draft')::jsonb);raise exception 'company writes draft';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{"sub":"e8abe85a-3441-4ce2-a7ab-cfb0e57dc168","role":"authenticated","is_anonymous":true}',true);
do $$ begin
 if exists(select 1 from public.youth_cv_drafts) then raise exception 'anonymous identity sees draft'; end if;
 begin perform public.save_my_cv_draft(null,current_setting('mnw.test.cv_draft')::jsonb);raise exception 'anonymous writes draft';exception when insufficient_privilege then null;end;
end $$;
reset role;
set local role anon;
select set_config('request.jwt.claims','{"role":"anon"}',true);
do $$ begin
 begin perform * from public.youth_cv_drafts;raise exception 'anon table read allowed';exception when insufficient_privilege then null;end;
 begin perform public.save_my_cv_draft(null,null);raise exception 'anon RPC allowed';exception when insufficient_privilege then null;end;
end $$;
reset role;
do $$ begin if not exists(select 1 from pg_constraint where conrelid='public.youth_cv_drafts'::regclass and confrelid='public.youth_profiles'::regclass and contype='f' and confdeltype='c')then raise exception 'cascade FK missing';end if;end $$;
select 'PASS own/cross-account/role/RLS/write restrictions, size/schema/approval rejection, stale create/update/clear, tombstone and CV separation. Cascade checked as metadata; all fixtures roll back.' as result;
rollback;
