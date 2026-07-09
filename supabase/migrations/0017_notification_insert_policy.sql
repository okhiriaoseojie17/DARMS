-- 0017_notification_insert_policy.sql
-- Migration 0010 enabled RLS on notifications but only added self-read/
-- self-update policies — there was no way for anyone to ever create a
-- notification for someone else, which is exactly what "notify the uploader
-- when their upload is approved/rejected" requires. This policy is
-- deliberately coarse (any reviewer can notify any profile) rather than
-- scoped to the exact upload, since a notification is informational, not
-- access to anything — the same trade-off already accepted for the
-- approved-bucket write policy before it was tightened, but lower-stakes
-- here so left as-is.

create policy "notifications_reviewer_insert" on notifications
for insert
with check (
  exists (
    select 1 from permission_assignments pa
    join permissions p on p.id = pa.permission_id
    where pa.profile_id = auth.uid()
      and p.key in ('approve_uploads', 'reject_uploads')
      and pa.revoked_at is null
  )
);
