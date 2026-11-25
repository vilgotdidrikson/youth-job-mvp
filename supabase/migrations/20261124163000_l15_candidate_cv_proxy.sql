-- Apply after deploying the authenticated candidate CV proxy. The owner keeps
-- their own folder access and the service reads only a freshly authorized path.
drop policy "verified owners read submitted candidate CV" on storage.objects;
