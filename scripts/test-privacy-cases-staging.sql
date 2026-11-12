-- DevStaging only. Synthetic identities/factors/sessions and all writes roll back.
-- This checks SQL authority/lifecycle, not a real password or authenticator challenge.
begin;
insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data,raw_app_meta_data,aud,role,created_at,updated_at) values
 ('a7d94e14-6fd9-478d-9089-c7d3f9672201','qa-privacy-case-owner@example.invalid',now(),'{"role":"youth"}','{}','authenticated','authenticated',now(),now()),
 ('a7d94e14-6fd9-478d-9089-c7d3f9672202','qa-privacy-case-other@example.invalid',now(),'{"role":"company"}','{}','authenticated','authenticated',now(),now()),
 ('a7d94e14-6fd9-478d-9089-c7d3f9672203','qa-privacy-case-handler@example.invalid',now(),'{"role":"youth"}','{}','authenticated','authenticated',now(),now()),
 ('a7d94e14-6fd9-478d-9089-c7d3f9672204','qa-privacy-case-admin-only@example.invalid',now(),'{"role":"youth"}','{}','authenticated','authenticated',now(),now());
insert into public.admin_users(user_id)values('a7d94e14-6fd9-478d-9089-c7d3f9672203'),('a7d94e14-6fd9-478d-9089-c7d3f9672204');
insert into private.privacy_case_handlers(user_id)values('a7d94e14-6fd9-478d-9089-c7d3f9672203');
insert into auth.mfa_factors(id,user_id,factor_type,status,secret,created_at,updated_at)values
 ('a7d94e14-6fd9-478d-9089-c7d3f9672210','a7d94e14-6fd9-478d-9089-c7d3f9672203','totp','verified','QA_SYNTHETIC_NOT_AN_AUTH_FACTOR',now(),now());
insert into auth.sessions(id,user_id,created_at,updated_at,not_after)values('a7d94e14-6fd9-478d-9089-c7d3f9672211','a7d94e14-6fd9-478d-9089-c7d3f9672203',now(),now(),now()+interval '5 minutes');
set local role service_role;
do $$ declare c jsonb; saved jsonb; first_revision uuid; due text;begin
 if not public.privacy_case_intake_available() then raise exception 'configured synthetic intake missing';end if;
 c:=public.create_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672201','a7d94e14-6fd9-478d-9089-c7d3f9672220','correction','QA rättelse – åäö');
 if c->>'body'<>'QA rättelse – åäö' or c->>'is_mine'<>'false' then raise exception 'invalid projection';end if;
 first_revision:=(c->>'revision')::uuid;due:=c->>'reply_due_at';
 saved:=public.create_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672201','a7d94e14-6fd9-478d-9089-c7d3f9672220','correction','QA rättelse – åäö');
 if saved->>'revision'<>c->>'revision' then raise exception 'duplicate create';end if;
 if jsonb_array_length(public.list_privacy_cases('a7d94e14-6fd9-478d-9089-c7d3f9672202')->'cases')<>0 then raise exception 'foreign list leak';end if;
 begin perform public.list_privacy_cases(null,'a7d94e14-6fd9-478d-9089-c7d3f9672204');raise exception 'ungranted admin read';exception when insufficient_privilege then null;end;
 c:=public.update_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672203','a7d94e14-6fd9-478d-9089-c7d3f9672211',(c->>'id')::uuid,first_revision,'a7d94e14-6fd9-478d-9089-c7d3f9672230','claim','');
 begin perform public.update_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672203','a7d94e14-6fd9-478d-9089-c7d3f9672211',(c->>'id')::uuid,first_revision,gen_random_uuid(),'claim','');raise exception 'stale claim accepted';exception when sqlstate 'PT409' then null;end;
 c:=public.update_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672203','a7d94e14-6fd9-478d-9089-c7d3f9672211',(c->>'id')::uuid,(c->>'revision')::uuid,gen_random_uuid(),'waiting','QA komplettera');
 saved:=c;
 c:=public.reply_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672201',(c->>'id')::uuid,(c->>'revision')::uuid,'a7d94e14-6fd9-478d-9089-c7d3f9672231','QA eget svar');
 if c->>'status'<>'in_progress' then raise exception 'reply status';end if;
 if (public.reply_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672201',(c->>'id')::uuid,(saved->>'revision')::uuid,'a7d94e14-6fd9-478d-9089-c7d3f9672231','QA eget svar')->>'revision')<>(c->>'revision') then raise exception 'duplicate reply';end if;
 begin perform public.reply_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672202',(c->>'id')::uuid,(c->>'revision')::uuid,gen_random_uuid(),'Foreign');raise exception 'foreign reply accepted';exception when sqlstate 'PT404' then null;end;
 c:=public.update_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672203','a7d94e14-6fd9-478d-9089-c7d3f9672211',(c->>'id')::uuid,(c->>'revision')::uuid,gen_random_uuid(),'close','QA avslut');
 if not exists(select 1 from private.privacy_cases where id=(c->>'id')::uuid and retention_until=closed_at+interval '12 months') then raise exception 'retention marker';end if;
 c:=public.update_privacy_case('a7d94e14-6fd9-478d-9089-c7d3f9672203','a7d94e14-6fd9-478d-9089-c7d3f9672211',(c->>'id')::uuid,(c->>'revision')::uuid,gen_random_uuid(),'reopen','');
 if c->>'reply_due_at'<>due or c->>'closed_at' is not null then raise exception 'reopen changed deadline';end if;
 update private.privacy_case_handlers set enabled=false where user_id='a7d94e14-6fd9-478d-9089-c7d3f9672203';
 begin perform public.list_privacy_cases(null,'a7d94e14-6fd9-478d-9089-c7d3f9672203');raise exception 'revoked handler read';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role authenticated;
do $$begin
 begin perform public.list_privacy_cases('a7d94e14-6fd9-478d-9089-c7d3f9672201');raise exception 'authenticated RPC bypass';exception when insufficient_privilege then null;end;
 begin perform * from private.privacy_cases;raise exception 'authenticated table bypass';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role anon;
do $$begin
 begin perform public.privacy_case_access('a7d94e14-6fd9-478d-9089-c7d3f9672203');raise exception 'anonymous RPC bypass';exception when insufficient_privilege then null;end;
end$$;
reset role;
select 'PASS DevStaging SQL: configured synthetic scope, own/idempotent create, foreign denial, explicit handler access, stale claim, public response, own/idempotent follow-up, close/reopen/deadline/retention, revoked grant and authenticated/anon direct denial. Auth challenges and parallel transactions are NOT tested here. All fixtures roll back.' as result;
rollback;
