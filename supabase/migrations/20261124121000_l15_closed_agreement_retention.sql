create index closed_company_agreement_receipts_ended_at_idx
  on private.closed_company_agreement_receipts (ended_at, former_company_user_id, version);

-- Apply with the release migrations after confirming backup and restoration readiness.
do $$
declare task bigint;
begin
  if not exists (select 1 from pg_extension where extname='pg_cron') then return; end if;
  if not exists (select 1 from cron.job where jobname='mnw-closed-company-agreement-retention') then
    task := cron.schedule('mnw-closed-company-agreement-retention', '43 * * * *',
      'select private.purge_closed_company_agreements(statement_timestamp()-interval ''3 years'',500)');
    perform cron.alter_job(task, active:=false);
  end if;
end;
$$;
