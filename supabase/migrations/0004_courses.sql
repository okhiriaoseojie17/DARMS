-- 0004_courses.sql

create type course_status as enum ('pending', 'approved', 'archived', 'rejected');

create table courses (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  title text not null,
  department_id uuid not null references departments(id),
  level_id uuid not null references levels(id),
  semester text not null,
  status course_status not null default 'pending',
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (code, department_id, level_id, semester)
);

-- Now that courses exists, wire the deferred FK from migration 0003.
alter table permission_assignments
  add constraint permission_assignments_course_fk
  foreign key (scope_course_id) references courses(id);

create table course_settings (
  course_id uuid primary key references courses(id) on delete cascade,
  ai_indexing_allowed boolean not null default true
);

create table course_creation_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references profiles(id),
  department_id uuid not null references departments(id),
  level_id uuid not null references levels(id),
  code text not null,
  title text not null,
  semester text not null,
  status text not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  decision_reason text,
  created_at timestamptz not null default now()
);

create table course_lecturers (
  course_id uuid references courses(id) on delete cascade,
  profile_id uuid references profiles(id) on delete cascade,
  assigned_by uuid references profiles(id),
  assigned_at timestamptz not null default now(),
  primary key (course_id, profile_id)
);

create table course_admin_requests (
  id uuid primary key default gen_random_uuid(),
  requested_by uuid not null references profiles(id),
  course_id uuid not null references courses(id),
  status text not null default 'pending',
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);
