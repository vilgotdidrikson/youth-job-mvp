-- DevStaging only: replace the three __QA_*__ placeholders with FIXTURE output.
-- No admin membership is created. The company and all three jobs stay unverified.
begin;
do $$ begin if (select count(*) from auth.users where (id='__QA_YOUTH_UUID__' and email='__QA_PREFIX__-youth@example.invalid') or (id='__QA_COMPANY_UUID__' and email='__QA_PREFIX__-company@example.invalid'))<>2 then raise exception 'Fictional fixture identities required';
end if;
end $$;
update public.youth_profiles set full_name='QA L08 Fiktiv Testperson',age=18,city='Stockholm',short_onboarding_completed=true where user_id='__QA_YOUTH_UUID__';
update public.company_profiles set company_name='QA L08 FIKTIVT TESTFÖRETAG',administrator='QA Testkontakt',city='Stockholm',description='Enbart fiktiv gränssnittstestning, ingen riktig rekrytering.',organization_number='000000-0000' where user_id='__QA_COMPANY_UUID__';
insert into public.jobs(company_user_id,company_name,title,description,city,address,longitude,latitude,status,is_active,publication_status) values ('__QA_COMPANY_UUID__','QA L08 FIKTIVT TESTFÖRETAG','QA L08 TEST Stockholm – EJ RIKTIGT JOBB','Fiktivt testjobb, sök inte.','Stockholm','QA Testplats',18.06,59.33,'active',true,'published'),('__QA_COMPANY_UUID__','QA L08 FIKTIVT TESTFÖRETAG','QA L08 TEST Göteborg – EJ RIKTIGT JOBB','Fiktivt testjobb, sök inte.','Göteborg','QA Testplats',11.97,57.7,'active',true,'published'),('__QA_COMPANY_UUID__','QA L08 FIKTIVT TESTFÖRETAG','QA L08 TEST Malmö – EJ RIKTIGT JOBB','Fiktivt testjobb, sök inte.','Malmö','QA Testplats',13.0,55.6,'active',true,'published');
do $$ begin if not exists(select 1 from public.company_profiles where user_id='__QA_COMPANY_UUID__' and verification_status='pending') then raise exception 'Unverified fixture required';
end if;
if (select count(*) from public.jobs where company_user_id='__QA_COMPANY_UUID__' and publication_status='pending_verification')<>3 then raise exception 'Fixture jobs must stay hidden';
end if;
end $$;
commit;
