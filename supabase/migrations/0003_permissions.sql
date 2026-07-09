-- 0003_permissions.sql
-- Permissions are assignment-based and scoped. "Roles" are just display presets
-- that pre-fill a bundle of permission_assignments — they are never checked
-- directly for authorization. See §6 of the architecture doc.

create table permissions (
  id uuid primary key default gen_random_uuid(),
  key text not null unique,
  description text
);

insert into permissions (key, description) values
  ('approve_uploads', 'Approve pending student uploads'),
  ('reject_uploads', 'Reject pending student uploads'),
  ('auto_approve', 'Uploads from this user skip the review queue within scope'),
  ('delete_uploads', 'Delete approved or archived uploads'),
  ('delete_folders', 'Delete course folders'),
  ('assign_lecturers', 'Assign lecturers to courses'),
  ('approve_lecturers', 'Approve a lecturer''s course admin request'),
  ('manage_users', 'Manage user profiles'),
  ('manage_permissions', 'Grant or revoke permission assignments'),
  ('manage_departments', 'Create or edit departments'),
  ('manage_levels', 'Create or edit levels'),
  ('manage_courses', 'Create or edit courses'),
  ('view_audit_logs', 'View system-wide audit logs');

create table roles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

insert into roles (name) values
  ('Student Administrator'),
  ('Lecturer Administrator'),
  ('Level Advisor'),
  ('Department Administrator'),
  ('Super Administrator');

create table role_permission_templates (
  role_id uuid references roles(id) on delete cascade,
  permission_id uuid references permissions(id) on delete cascade,
  primary key (role_id, permission_id)
);

-- permission_assignments references courses(id), created in migration 0004.
-- Table is created here with a deferred FK added at the end of 0004.
create table permission_assignments (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  permission_id uuid not null references permissions(id),
  scope_department_id uuid references departments(id),
  scope_level_id uuid references levels(id),
  scope_course_id uuid,  -- FK added in 0004 once courses exists
  granted_by uuid references profiles(id),
  granted_at timestamptz not null default now(),
  revoked_at timestamptz
);
