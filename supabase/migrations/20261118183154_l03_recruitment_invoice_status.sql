-- Expose only the invoice state for the company that owns this recruitment.
create function public.get_recruitment_invoice_status(p_match_id uuid)
returns text language sql stable security definer set search_path = '' as $$
  select case
    when i.held_at is not null or b.held_at is not null then 'held'
    when i.issued_on is not null or b.invoice_number is not null then 'issued'
    when i.id is not null or b.id is not null then 'pending'
    else 'none'
  end
  from public.employment_records e
  left join private.hire_test_invoices i on i.match_id=e.match_id and i.company_user_id=e.company_user_id
  left join private.hire_bank_invoices b on b.match_id=e.match_id and b.company_user_id=e.company_user_id
  where e.match_id=p_match_id and e.company_user_id=auth.uid();
$$;

revoke all on function public.get_recruitment_invoice_status(uuid) from public, anon, authenticated, service_role;
grant execute on function public.get_recruitment_invoice_status(uuid) to authenticated;
