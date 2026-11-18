-- Pilot candidates need both short onboarding and a CV to open their existing chat.
alter function public.prepare_hire_invoice_pilot_accounts(uuid,uuid) set schema private;
revoke all on function private.prepare_hire_invoice_pilot_accounts(uuid,uuid) from public, anon, authenticated, service_role;

create function public.prepare_hire_invoice_pilot_accounts(p_company uuid, p_youth uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare pilot_match uuid;
begin
  pilot_match := private.prepare_hire_invoice_pilot_accounts(p_company,p_youth);
  update public.youth_profiles set cv_text = 'Fiktivt CV för fakturatest i DevStaging.'
  where user_id=p_youth and nullif(btrim(cv_text),'') is null;
  return pilot_match;
end;
$$;

revoke all on function public.prepare_hire_invoice_pilot_accounts(uuid,uuid) from public, anon, authenticated, service_role;
grant execute on function public.prepare_hire_invoice_pilot_accounts(uuid,uuid) to authenticated;

-- An existing pair may already have a pending registration. Keep that test and unlock its chat.
update public.youth_profiles y set cv_text = 'Fiktivt CV för fakturatest i DevStaging.'
from auth.users u
where y.user_id=u.id and y.short_onboarding_completed and nullif(btrim(y.cv_text),'') is null
  and u.raw_app_meta_data->>'invoice_pilot_role'='youth'
  and u.email='mnw-invoice-youth-'||(u.raw_app_meta_data->>'invoice_pilot_owner')||'@example.invalid';
