-- L13/N19/F26 DevStaging probe. No fixtures or data changes; always rolls back.
begin;
set local role anon;
do $$begin
 begin perform public.get_my_application_correction_preview(null,null);raise exception 'anon preview allowed';exception when insufficient_privilege then null;end;
 begin perform public.correct_my_application_disclosure(null,null,null,null,null);raise exception 'anon correction allowed';exception when insufficient_privilege then null;end;
end$$;
reset role;
set local role authenticated;
select set_config('request.jwt.claim.sub','',true),set_config('request.jwt.claims','{}',true);
do $$begin
 begin perform public.get_my_application_correction_preview(null,null);raise exception 'missing identity preview allowed';exception when insufficient_privilege then null;end;
 begin perform public.correct_my_application_disclosure(null,null,null,null,null);raise exception 'missing identity correction allowed';exception when insufficient_privilege then null;end;
 if exists(select 1 from public.candidate_assessments) then raise exception 'identityless RLS returned assessments';end if;
end$$;
reset role;
select 'PASS 5 negative SQL checks; synthetic JWT/role context, not real Auth login.' as result;
rollback;
