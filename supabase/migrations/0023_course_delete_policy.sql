-- 0023_course_delete_policy.sql
-- Courses had a public-read policy and (per 0019) a scoped insert policy for
-- manage_courses holders, but no update policy at all — meaning there was no
-- RLS-sanctioned way to change an existing course's status (e.g. to archive
-- one), only to create new ones. This adds that, scoped the same way 0019
-- scopes course creation: to manage_courses holders within the matching
-- department (or department-wide holders, where scope_department_id is null).

create policy "courses_reviewer_update_scoped" on courses
  for update using (
    exists (
      select 1 from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key = 'manage_courses'
        and pa.revoked_at is null
        and (pa.scope_department_id is null or pa.scope_department_id = courses.department_id)
    )
  );
