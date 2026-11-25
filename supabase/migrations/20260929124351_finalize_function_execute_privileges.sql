-- Staging recorded this migration immediately before the historically
-- future-dated company-verification migration. The durable final grants are
-- kept at the end of that migration so they run after function creation.
select 1;
