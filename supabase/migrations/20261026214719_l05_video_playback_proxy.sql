-- Apply after deploying /api/videos/playback. Authenticated object GETs can be
-- served from the Storage CDN after a block; browser max-age=0 does not prevent
-- that. Only the server, after fresh caller-RLS checks, may read video bytes.
-- Upload registration/INSERT and service cleanup remain unchanged.
alter policy "video downloads only" on storage.objects
 using (bucket_id <> 'youth-profile-videos');
