-- 0010_rls_policies.sql
-- RLS is the source of truth for authorization. API routes may add friendlier
-- error messages, but every actual permission decision is enforced here.

alter table profiles enable row level security;
alter table departments enable row level security;
alter table levels enable row level security;
alter table courses enable row level security;
alter table uploads enable row level security;
alter table permission_assignments enable row level security;
alter table course_creation_requests enable row level security;
alter table course_admin_requests enable row level security;
alter table audit_logs enable row level security;
alter table notifications enable row level security;

-- Departments / levels: public read (guests browse without an account)
create policy "departments_public_read" on departments for select using (true);
create policy "levels_public_read" on levels for select using (true);

-- Courses: approved courses are public; pending/rejected only visible to
-- the requester and anyone with manage_courses in scope.
create policy "courses_public_read_approved" on courses
  for select using (status = 'approved');

create policy "courses_owner_read_pending" on courses
  for select using (
    created_by = auth.uid()
    or exists (
      select 1 from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key = 'manage_courses'
        and pa.revoked_at is null
        and (pa.scope_department_id is null or pa.scope_department_id = courses.department_id)
    )
  );

-- Uploads: approved uploads are public. Pending/rejected/archived visible only
-- to the uploader and scoped reviewers.
create policy "uploads_public_read_approved" on uploads
  for select using (status = 'approved');

create policy "uploads_owner_read_own" on uploads
  for select using (uploader_id = auth.uid());

create policy "uploads_reviewer_read_scoped" on uploads
  for select using (
    exists (
      select 1 from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key in ('approve_uploads', 'reject_uploads', 'delete_uploads')
        and pa.revoked_at is null
        and (pa.scope_course_id is null or pa.scope_course_id = uploads.course_id)
        and (pa.scope_department_id is null or pa.scope_department_id = uploads.department_id)
        and (pa.scope_level_id is null or pa.scope_level_id = uploads.level_id)
    )
  );

-- Any authenticated user may insert an upload for themselves. The actual
-- resulting status (pending vs auto-approved) is decided by the trigger in
-- migration 0009, not by anything the client sends.
create policy "uploads_authenticated_insert_own" on uploads
  for insert with check (uploader_id = auth.uid());

-- Students may only delete their own PENDING uploads.
create policy "uploads_owner_delete_pending" on uploads
  for delete using (uploader_id = auth.uid() and status = 'pending');

-- Scoped reviewers may update status (approve/reject/archive/delete) within scope.
create policy "uploads_reviewer_update_scoped" on uploads
  for update using (
    exists (
      select 1 from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key in ('approve_uploads', 'reject_uploads', 'delete_uploads')
        and pa.revoked_at is null
        and (pa.scope_course_id is null or pa.scope_course_id = uploads.course_id)
        and (pa.scope_department_id is null or pa.scope_department_id = uploads.department_id)
        and (pa.scope_level_id is null or pa.scope_level_id = uploads.level_id)
    )
  );

-- Profiles: users read/update their own profile; anyone can read public
-- display fields of other profiles (needed to show "uploaded by X").
create policy "profiles_self_read" on profiles for select using (true);
create policy "profiles_self_update" on profiles
  for update using (id = auth.uid());

-- Permission assignments: only visible to the assignee and to holders of
-- manage_permissions within an overlapping scope. Only manage_permissions
-- holders may insert/update, and only within a scope they themselves hold
-- (enforced in application code per §14 of the architecture doc — Postgres
-- RLS here checks the base permission; the "can't grant broader than you
-- hold" rule is additionally checked in src/lib/permissions).
create policy "permission_assignments_self_read" on permission_assignments
  for select using (profile_id = auth.uid());

create policy "permission_assignments_manager_read" on permission_assignments
  for select using (
    exists (
      select 1 from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key = 'manage_permissions'
        and pa.revoked_at is null
    )
  );

create policy "permission_assignments_manager_insert" on permission_assignments
  for insert with check (
    exists (
      select 1 from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key = 'manage_permissions'
        and pa.revoked_at is null
    )
  );

-- Course creation / admin requests: visible to requester and relevant reviewers.
create policy "course_creation_requests_owner_read" on course_creation_requests
  for select using (requested_by = auth.uid());

create policy "course_creation_requests_authenticated_insert" on course_creation_requests
  for insert with check (requested_by = auth.uid());

create policy "course_admin_requests_owner_read" on course_admin_requests
  for select using (requested_by = auth.uid());

create policy "course_admin_requests_authenticated_insert" on course_admin_requests
  for insert with check (requested_by = auth.uid());

-- Audit logs: only view_audit_logs holders.
create policy "audit_logs_permission_read" on audit_logs
  for select using (
    exists (
      select 1 from permission_assignments pa
      join permissions p on p.id = pa.permission_id
      where pa.profile_id = auth.uid()
        and p.key = 'view_audit_logs'
        and pa.revoked_at is null
    )
  );

-- Notifications: only the owner.
create policy "notifications_owner_read" on notifications
  for select using (profile_id = auth.uid());

create policy "notifications_owner_update" on notifications
  for update using (profile_id = auth.uid());
