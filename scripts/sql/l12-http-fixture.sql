-- New disposable DevStaging identities only. The caller must clean up this batch.
begin;
create temporary table l12_http_output(config jsonb);
do $$
declare u uuid:=gen_random_uuid(); c uuid:=gen_random_uuid(); b uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); a uuid:=gen_random_uuid();
 j uuid:=gen_random_uuid(); other_j uuid:=gen_random_uuid(); paused uuid:=gen_random_uuid(); v_mid uuid:=gen_random_uuid(); conv uuid; active_conv uuid; active_mid uuid:=gen_random_uuid(); msg uuid:=gen_random_uuid();
 actor record; password text; actors jsonb:='[]'; p jsonb; cv_path text;
begin
 for actor in select * from (values('youth',u,'youth'),('company',c,'company'),('wrongCompany',b,'company'),('outsider',o,'youth'),('admin',a,'private')) q(name,id,account_role) loop
  password:=gen_random_uuid()::text||gen_random_uuid()::text;
  insert into auth.users(id,instance_id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,
   confirmation_token,recovery_token,email_change_token_new,email_change,email_change_token_current,reauthentication_token,created_at,updated_at,is_super_admin)
  values(actor.id,'00000000-0000-0000-0000-000000000000','authenticated','authenticated','qa-l12-http-'||actor.id||'@example.invalid',
   extensions.crypt(password,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}',jsonb_build_object('role',actor.account_role),
   '','','','','','',now(),now(),false);
  actors:=actors||jsonb_build_array(jsonb_build_object('name',actor.name,'id',actor.id,'email','qa-l12-http-'||actor.id||'@example.invalid','password',password));
 end loop;
 insert into public.admin_users(user_id) values(a);
 perform set_config('request.jwt.claim.sub',a::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 update public.company_profiles set company_name='QA L12 HTTP fictional',verification_status='verified' where user_id in(c,b);
 cv_path:=u::text||'/qa-l12-http.pdf';
 update public.youth_profiles set full_name='QA L12 HTTP youth',cv_generated=true,
  cv_text='QA L12 HTTP. Jag har serviceerfarenhet och kan arbeta helger.',
  address='PRIVATE_L05_HTTP_HOME',documents=jsonb_build_array(jsonb_build_object('type','cv','name','qa-l12-http.pdf','url',cv_path)) where user_id=u;
 insert into public.jobs(id,company_user_id,company_name,title,description,address) values
  (j,c,'QA L12 HTTP','QA L12 HTTP active','QA fictional test listing','QA Testgatan 1'),
  (other_j,c,'QA L12 HTTP','QA L12 HTTP no applicant','QA fictional test listing','QA Testgatan 2'),
  (paused,c,'QA L12 HTTP','QA L12 HTTP paused','PRIVATE_L05_HTTP_PAUSED','QA Testgatan 3');
 update public.jobs set status='paused',is_active=false where id=paused;
 insert into public.job_match_profiles(job_id,status,role_summary,weighted_criteria,candidate_questions) values(j,'approved','QA fictional role','[]','[]'),(other_j,'approved','QA fictional role','[]','[]');
 insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values(v_mid,u,c,j,'matched');
 select id into conv from public.conversations x where x.match_id=v_mid;
 if conv is null then insert into public.conversations(match_id,youth_user_id,company_user_id,job_id) values(v_mid,u,c,j) returning id into conv; end if;
 insert into public.matches(id,youth_user_id,company_user_id,job_id,status) values(active_mid,u,c,other_j,'matched');
 insert into public.conversations(match_id,youth_user_id,company_user_id,job_id) values(active_mid,u,c,other_j) returning id into active_conv;
 perform set_config('request.jwt.claim.sub',u::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',u,'role','authenticated')::text,true);
 set local role authenticated;
 p:=public.get_my_application_disclosure_preview(j,'{}');
 perform public.save_my_application_disclosure(j,'{}',p->>'source_token');
 perform public.prepare_my_application(j,false);
 p:=public.get_my_application_disclosure_preview(other_j,'{}'); perform public.save_my_application_disclosure(other_j,'{}',p->>'source_token'); perform public.prepare_my_application(other_j,false);
 insert into public.messages(id,conversation_id,sender_user_id,message_text) values(msg,conv,u,'QA L12 HTTP fictional message');
 reset role;
 -- Hide every fictional listing before commit; pausing does not close applications.
 update public.jobs set publication_status='pending_verification',status='paused',is_active=false where id in(j,other_j,paused);
 insert into l12_http_output values(jsonb_build_object('actors',actors,'job',j,'otherJob',other_j,'pausedJob',paused,'conversation',conv,'activeConversation',active_conv,'message',msg,'cvPath',cv_path));
end $$;
select config from l12_http_output;
commit;
