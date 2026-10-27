-- DevStaging only. All accounts and billing rows roll back.
begin;
do $$
declare
 c uuid:=gen_random_uuid(); other_c uuid:=gen_random_uuid(); youth uuid:=gen_random_uuid();
 details jsonb:='{"invoice_email":" QA@EXAMPLE.INVALID ","address_line1":" QA Gatan 1 ","address_line2":"","postal_code":"123 45","city":" QA Ort ","reference":"QA test"}';
 row_value public.company_billing_details%rowtype;
 bad jsonb;
begin
 insert into auth.users(id,email,raw_user_meta_data) values
 (c,'qa-l03-'||c||'@example.invalid','{"role":"company"}'),
 (other_c,'qa-l03-'||other_c||'@example.invalid','{"role":"company"}'),
 (youth,'qa-l03-'||youth||'@example.invalid','{"role":"youth"}');
 perform set_config('request.jwt.claim.sub',c::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 set local role authenticated;
 select * into row_value from public.save_company_billing_details(c,null,details);
 if row_value.version<>1 or row_value.user_id<>c or row_value.invoice_email<>'qa@example.invalid' or row_value.postal_code<>'12345' or row_value.address_line1<>'QA Gatan 1' then raise exception 'Normalization/create failed'; end if;
 if (select count(*) from public.company_billing_details)<>1 then raise exception 'Owner read failed'; end if;
 begin perform public.save_company_billing_details(other_c,null,details);raise exception 'Foreign account write';exception when insufficient_privilege then null;end;
 begin perform public.save_company_billing_details(c,null,details);raise exception 'Duplicate create overwrote';exception when serialization_failure then null;end;
 begin update public.company_billing_details set reference='BYPASS' where user_id=c;raise exception 'Direct update bypass';exception when insufficient_privilege then null;end;
 begin delete from public.company_billing_details where user_id=c;raise exception 'Direct delete bypass';exception when insufficient_privilege then null;end;
 begin insert into public.company_billing_details(user_id,invoice_email,address_line1,postal_code,city) values(c,'qa@example.invalid','QA','12345','QA');raise exception 'Direct insert bypass';exception when insufficient_privilege then null;end;
 select * into row_value from public.save_company_billing_details(c,1,details||'{"reference":"QA updated"}');
 if row_value.version<>2 or row_value.reference<>'QA updated' then raise exception 'Update failed';end if;
 begin perform public.save_company_billing_details(c,1,details);raise exception 'Stale write accepted';exception when serialization_failure then null;end;
 for bad in select value from jsonb_array_elements(jsonb_build_array(
 details||'{"extra":"private"}',details||'{"invoice_email":null}',details||'{"reference":1}',
 jsonb_build_object('invoice_email','qa@example.invalid'),'[]'::jsonb
 )) loop
  begin perform public.save_company_billing_details(c,2,bad);raise exception 'Invalid JSON accepted';exception when invalid_parameter_value then null;end;
 end loop;
 begin perform public.save_company_billing_details(c,2,details||jsonb_build_object('reference',E'QA\r\nBcc: secret@example.invalid'));raise exception 'Header injection accepted';exception when invalid_parameter_value then null;end;
 for bad in select value from jsonb_array_elements(jsonb_build_array(details||'{"invoice_email":"bad"}',details||'{"postal_code":"1234"}',details||'{"city":""}',details||jsonb_build_object('address_line1',repeat('x',151)))) loop
  begin perform public.save_company_billing_details(c,2,bad);raise exception 'Invalid value accepted';exception when check_violation then null;end;
 end loop;
 if (select version from public.company_billing_details where user_id=c)<>2 then raise exception 'Rejected request changed version';end if;
 reset role;
 perform set_config('request.jwt.claim.sub',other_c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',other_c,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.company_billing_details where user_id=c) then raise exception 'Foreign read';end if;
 begin perform public.save_company_billing_details(c,2,details);raise exception 'Foreign owner accepted';exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claim.sub',youth::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',youth,'role','authenticated')::text,true);
 set local role authenticated;
 if exists(select 1 from public.company_billing_details) then raise exception 'Youth read';end if;
 begin perform public.save_company_billing_details(youth,null,details);raise exception 'Youth write';exception when insufficient_privilege then null;end;
 reset role;
 perform set_config('request.jwt.claim.sub','',true);perform set_config('request.jwt.claims','{"role":"anon"}',true);
 set local role anon;
 begin perform 1 from public.company_billing_details;raise exception 'Anon read';exception when insufficient_privilege then null;end;
 begin perform public.save_company_billing_details(c,2,details);raise exception 'Anon RPC';exception when insufficient_privilege then null;end;
 reset role;
 delete from auth.users where id=c;
 if exists(select 1 from public.company_billing_details where user_id=c) then raise exception 'Account cascade left billing data';end if;
 perform set_config('request.jwt.claim.sub',c::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',c,'role','authenticated')::text,true);
 set local role authenticated;
 begin perform public.save_company_billing_details(c,null,details);raise exception 'Deleted account wrote';exception when insufficient_privilege then null;end;
 reset role;
end $$;
select 'PASS L03: normalization, create/update, stale/duplicate writes, direct writes, foreign owner, youth/anon, validation, header injection and deletion cascade. All fixtures roll back.' as result;
rollback;
