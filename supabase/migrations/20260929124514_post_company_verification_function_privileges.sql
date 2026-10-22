-- Staging history marker. The durable final grants live at the end of the
-- company-verification migration so clean replays apply them after creation.
select 1;
