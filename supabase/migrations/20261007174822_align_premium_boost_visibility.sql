-- Return boost flags only for announcements the caller may already read.
create or replace function public.premium_effective_boosts(p_job_ids uuid[])
returns table (job_id uuid, is_boosted boolean)
language sql stable security definer set search_path = public
as $$
  select job.id, exists (
    select 1 from public.premium_entitlements entitlement
    join public.premium_products product on product.id = entitlement.product_id
    where entitlement.job_id = job.id
      and entitlement.state <> 'cancelled'
      and product.kind = 'job_boost'
      and entitlement.starts_at <= now()
      and entitlement.ends_at > now()
  )
  from public.jobs job
  where job.id = any(coalesce(p_job_ids, '{}'::uuid[]))
    and (
      job.company_user_id = auth.uid()
      or (job.is_active = true and job.status = 'active' and job.publication_status = 'published')
    );
$$;
