-- Public job images may be read by anyone, but may only be written by the
-- company that owns the first path segment: {company_user_id}/{filename}.
-- The client already uses this path convention; no data migration is needed.

update storage.buckets
set
  file_size_limit = 2097152,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp']::text[]
where id = 'job-images';

drop policy if exists "job_images_insert" on storage.objects;
drop policy if exists "job_images_select" on storage.objects;
drop policy if exists "job images public read" on storage.objects;
drop policy if exists "job images company insert own path" on storage.objects;
drop policy if exists "job images company update own path" on storage.objects;
drop policy if exists "job images company delete own path" on storage.objects;

create policy "job images public read"
  on storage.objects for select
  using (bucket_id = 'job-images');

create policy "job images company insert own path"
  on storage.objects for insert
  with check (
    bucket_id = 'job-images'
    and auth.uid() is not null
    and auth.uid()::text = split_part(name, '/', 1)
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'company'
    )
  );

create policy "job images company update own path"
  on storage.objects for update
  using (
    bucket_id = 'job-images'
    and auth.uid()::text = split_part(name, '/', 1)
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'company'
    )
  )
  with check (
    bucket_id = 'job-images'
    and auth.uid()::text = split_part(name, '/', 1)
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'company'
    )
  );

create policy "job images company delete own path"
  on storage.objects for delete
  using (
    bucket_id = 'job-images'
    and auth.uid()::text = split_part(name, '/', 1)
    and exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'company'
    )
  );
