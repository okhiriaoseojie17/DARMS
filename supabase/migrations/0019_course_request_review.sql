-- 0019_course_request_review.sql
-- Adds the missing reviewer-side RLS policies for course_creation_requests
-- and courses. Previously only the requester could see/read their own
-- requests, and nothing could insert into `courses` at all — so approved
-- requests had no path to becoming a real course row.

drop policy if exists "course_creation_requests_reviewer_read" on course_creation_requests;
create policy "course_creation_requests_reviewer_read" on course_creation_requests
  for select using (
    exists (
      select 1
      from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key = 'manage_courses'
        and pa.revoked_at is null
        and (pa.scope_department_id is null or pa.scope_department_id = course_creation_requests.department_id)
    )
  );

drop policy if exists "course_creation_requests_reviewer_update" on course_creation_requests;
create policy "course_creation_requests_reviewer_update" on course_creation_requests
  for update using (
    exists (
      select 1
      from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key = 'manage_courses'
        and pa.revoked_at is null
        and (pa.scope_department_id is null or pa.scope_department_id = course_creation_requests.department_id)
    )
  );

drop policy if exists "courses_reviewer_insert" on courses;
create policy "courses_reviewer_insert" on courses
  for insert with check (
    exists (
      select 1
      from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key = 'manage_courses'
        and pa.revoked_at is null
        and (pa.scope_department_id is null or pa.scope_department_id = courses.department_id)
    )
  );