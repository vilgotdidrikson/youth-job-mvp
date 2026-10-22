-- ──────────────────────────────────────────────────────────
-- File uploads: youth documents + job images
-- Run in Supabase SQL Editor
-- ──────────────────────────────────────────────────────────

-- 1. Add documents column to youth_profiles
alter table public.youth_profiles
  add column if not exists documents jsonb not null default '[]'::jsonb;

-- 2. Create storage buckets (safe to run multiple times)
insert into storage.buckets (id, name, public)
  values ('youth-documents', 'youth-documents', true)
  on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('job-images', 'job-images', true)
  on conflict (id) do nothing;

-- 3. Storage RLS: youth-documents
--    Youth can upload/delete their own files (folder = their user id)
--    All authenticated users can read (companies need to view applicant docs)
drop policy if exists "youth_docs_insert" on storage.objects;
create policy "youth_docs_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'youth-documents'
    and auth.uid()::text = split_part(name, '/', 1)
  );

drop policy if exists "youth_docs_select" on storage.objects;
create policy "youth_docs_select"
  on storage.objects for select
  using (
    bucket_id = 'youth-documents'
    and auth.role() = 'authenticated'
  );

drop policy if exists "youth_docs_delete" on storage.objects;
create policy "youth_docs_delete"
  on storage.objects for delete
  using (
    bucket_id = 'youth-documents'
    and auth.uid()::text = split_part(name, '/', 1)
  );

-- 4. Storage RLS: job-images
--    Authenticated users (companies) can upload; bucket is public so anyone can read
drop policy if exists "job_images_insert" on storage.objects;
create policy "job_images_insert"
  on storage.objects for insert
  with check (
    bucket_id = 'job-images'
    and auth.role() = 'authenticated'
  );

drop policy if exists "job_images_select" on storage.objects;
create policy "job_images_select"
  on storage.objects for select
  using (bucket_id = 'job-images');
