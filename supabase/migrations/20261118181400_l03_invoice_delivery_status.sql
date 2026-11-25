-- Show delivery status after issuance. Only the invoice's company sees the destination address.
create or replace function private.list_hire_test_invoices(p_admin boolean)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
declare approved_recipient text;
begin
  if p_admin is true and not private.hire_test_invoice_admin() then
    raise exception 'Verifierad adminåtkomst krävs.' using errcode='42501';
  elsif p_admin is not true and not private.hire_invoice_test_company() then
    return '[]'::jsonb;
  end if;
  select lower(btrim(decrypted_secret)) into approved_recipient from vault.decrypted_secrets
    where name='mnw_hire_invoice_mail_test_recipient' limit 1;
  return coalesce((select jsonb_agg(
    jsonb_build_object('id',i.id,'amount_ore',i.amount_ore,'buyer_name',i.buyer_name,
      'address_line1',i.address_line1,'address_line2',i.address_line2,'postal_code',i.postal_code,'city',i.city,
      'issued_on',i.issued_on,'due_on',i.due_on,'held_at',i.held_at,'paid_at',i.paid_at,
      'mail_state',case
        when o.invoice_id is null then 'not_queued'
        when o.state='pending' and o.recipient is distinct from approved_recipient then 'test_recipient_mismatch'
        else o.state
      end,
      'invoice_email',case when p_admin is not true and i.company_user_id=auth.uid() then o.recipient end
    ) order by i.issued_on desc,i.id)
    from private.hire_test_invoices i
    left join private.hire_test_invoice_mail o on o.invoice_id=i.id
    where i.issued_on is not null and (p_admin is true or i.company_user_id=auth.uid())), '[]'::jsonb);
end;
$$;

create or replace function public.list_hire_bank_invoices(p_admin boolean default false)
returns jsonb language plpgsql stable security definer set search_path = '' as $$
begin
  if p_admin is true and not private.hire_test_invoice_admin() then
    raise exception 'Verifierad adminåtkomst krävs.' using errcode='42501';
  end if;
  return coalesce((select jsonb_agg(private.hire_bank_invoice_document(i) ||
      jsonb_build_object('invoice_email',case when p_admin is not true and i.company_user_id=auth.uid() then i.recipient end)
    order by i.issued_on desc,i.invoice_number desc)
    from private.hire_bank_invoices i
    where i.invoice_number is not null and (p_admin is true or i.company_user_id=auth.uid())), '[]'::jsonb);
end;
$$;
