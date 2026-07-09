-- 0013_storage_path_scoping.sql
-- Migration 0011's "pending_bucket_owner_insert" policy only checked that
-- SOME user was signed in, not that they were writing to their own path —
-- meaning any authenticated user could write to any object key in the
-- bucket. Tightening it here: object paths must be prefixed with the
-- uploader's own auth.uid(), e.g. "{uid}/{course_id}/{filename}", enforced
-- via Postgres storage.foldername().

drop policy if exists "pending_bucket_owner_insert" on storage.objects;

create policy "pending_bucket_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'uploads-pending'
  and auth.uid() is not null
  and (storage.foldername(name))[1] = auth.uid()::text
);
