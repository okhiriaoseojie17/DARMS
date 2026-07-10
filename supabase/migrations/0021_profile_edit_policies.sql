-- 0021_profile_edit_policies.sql
-- Migration 0012 gave users self_read + self_insert on profile_departments
-- and profile_levels — enough for one-time onboarding, since that flow only
-- ever inserts. Editing a selection later means deleting the old rows
-- first, which had no policy and would silently fail under RLS (0 rows
-- affected, no error). Adding self-delete closes that gap.

create policy "profile_departments_self_delete" on profile_departments
  for delete using (profile_id = auth.uid());

create policy "profile_levels_self_delete" on profile_levels
  for delete using (profile_id = auth.uid());
