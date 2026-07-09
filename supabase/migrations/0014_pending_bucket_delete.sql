-- 0014_pending_bucket_delete.sql
-- Neither migration 0011 nor 0013 added a DELETE policy for the pending
-- bucket — needed now for two real cases: (1) a reviewer approving an
-- upload moves the file to the approved bucket and must remove the pending
-- copy, (2) a student deleting their own still-pending upload should also
-- remove the underlying file, not just the database row.

create policy "pending_bucket_reviewer_delete"
on storage.objects for delete
using (
  bucket_id = 'uploads-pending'
  and exists (
    select 1 from permission_assignments pa
    join permissions p on p.id = pa.permission_id
    where pa.profile_id = auth.uid()
      and p.key in ('approve_uploads', 'reject_uploads', 'delete_uploads')
      and pa.revoked_at is null
  )
);

create policy "pending_bucket_owner_delete"
on storage.objects for delete
using (
  bucket_id = 'uploads-pending'
  and (storage.foldername(name))[1] = auth.uid()::text
);
