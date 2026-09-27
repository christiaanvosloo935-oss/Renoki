-- =====================================================================
-- Renoki — Storage buckets and policies
--   entry-images : public read; users write only under `<their uid>/...`
--   avatars      : public read; users write only under `<their uid>/...`
-- Limits are enforced server-side by the bucket (size + MIME type).
-- The client additionally resizes to WebP before upload
-- (display <= 1600px, thumb <= 640px) to protect the free-tier quota.
-- =====================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('entry-images', 'entry-images', true, 5242880,  -- 5 MB
   array['image/jpeg', 'image/png', 'image/webp']),
  ('avatars',      'avatars',      true, 2097152,  -- 2 MB
   array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public buckets serve files via the public URL without a SELECT policy,
-- so we deliberately add NO broad select policy (prevents listing all files).
-- Owners may list their own folder (needed for upsert/cleanup).
create policy "owners list own images"
  on storage.objects for select to authenticated
  using (bucket_id in ('entry-images', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owners upload own images"
  on storage.objects for insert to authenticated
  with check (bucket_id in ('entry-images', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owners update own images"
  on storage.objects for update to authenticated
  using (bucket_id in ('entry-images', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id in ('entry-images', 'avatars')
              and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "owners delete own images"
  on storage.objects for delete to authenticated
  using (bucket_id in ('entry-images', 'avatars')
         and (storage.foldername(name))[1] = (select auth.uid())::text);
