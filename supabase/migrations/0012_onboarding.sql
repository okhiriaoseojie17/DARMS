-- 0012_onboarding.sql

alter table profiles add column profile_type text check (profile_type in ('student', 'lecturer'));
alter table profiles add column onboarding_completed boolean not null default false;

-- These three tables were created in earlier migrations but never had RLS
-- enabled — without it, Supabase's default grants make them readable/writable
-- by anyone. Closing that now, before any real data goes into them.
alter table profile_departments enable row level security;
alter table profile_levels enable row level security;
alter table course_lecturers enable row level security;

create policy "profile_departments_self_read" on profile_departments
  for select using (profile_id = auth.uid());
create policy "profile_departments_self_insert" on profile_departments
  for insert with check (profile_id = auth.uid());

create policy "profile_levels_self_read" on profile_levels
  for select using (profile_id = auth.uid());
create policy "profile_levels_self_insert" on profile_levels
  for insert with check (profile_id = auth.uid());

-- course_lecturers is publicly readable (used to show "taught by" on course
-- pages) but only self-insertable — a lecturer declaring "I teach this
-- course" here is informational only; it does NOT grant approval/auto-approve
-- rights, which still require an admin-granted permission_assignment.
create policy "course_lecturers_public_read" on course_lecturers
  for select using (true);
create policy "course_lecturers_self_insert" on course_lecturers
  for insert with check (profile_id = auth.uid());
