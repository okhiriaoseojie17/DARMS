-- 0024_notifications_delete_policy.sql
-- notifications had select + update policies (migration 0010) but no
-- delete policy — meaning there was no RLS-sanctioned way for a user to
-- clear their own notifications, only mark them read.

create policy "notifications_owner_delete" on notifications
  for delete using (profile_id = auth.uid());
