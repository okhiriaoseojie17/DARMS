-- 0005_uploads.sql

create type upload_status as enum ('pending', 'approved', 'rejected', 'archived', 'deleted');
create type upload_file_type as enum ('pdf', 'docx', 'pptx', 'image', 'link');

create table uploads (
  id uuid primary key default gen_random_uuid(),
  uploader_id uuid not null references profiles(id),
  course_id uuid not null references courses(id),
  department_id uuid not null references departments(id),
  level_id uuid not null references levels(id),
  semester text not null,
  academic_year text not null,
  file_type upload_file_type not null,
  display_label text not null,
  generated_filename text not null,
  status upload_status not null default 'pending',
  storage_path text,
  external_url text,
  file_hash text,
  file_size_bytes bigint,
  version int not null default 1,
  ai_processing_status text default 'not_started',
  rejection_reason text,
  created_at timestamptz not null default now(),
  reviewed_by uuid references profiles(id),
  reviewed_at timestamptz,
  archived_at timestamptz,
  restored_at timestamptz,
  deleted_at timestamptz
);

create table approval_events (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references uploads(id) on delete cascade,
  actor_id uuid references profiles(id),
  from_status upload_status,
  to_status upload_status not null,
  reason text,
  created_at timestamptz not null default now()
);

create index uploads_course_status_idx on uploads (course_id, status);
create index uploads_dept_level_semester_year_idx
  on uploads (department_id, level_id, semester, academic_year);
