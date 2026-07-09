-- 0001_reference_tables.sql
-- Departments and levels are pure data so the system can expand university-wide
-- without any code change. Never special-case a department/level name in app code.

create extension if not exists pgcrypto;

create table departments (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  code text not null unique,          -- e.g. 'CS', 'MIS', 'SHARED'
  created_at timestamptz not null default now()
);

create table levels (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,          -- '100', '200', '300', '400'
  sort_order int not null
);

create table department_levels (
  department_id uuid references departments(id) on delete cascade,
  level_id uuid references levels(id) on delete cascade,
  primary key (department_id, level_id)
);

-- Seed the initial department scope
insert into departments (name, code) values
  ('Computer Science', 'CS'),
  ('Management Information Systems', 'MIS'),
  ('Shared Department', 'SHARED');

insert into levels (name, sort_order) values
  ('100', 1), ('200', 2), ('300', 3), ('400', 4);

insert into department_levels (department_id, level_id)
select d.id, l.id from departments d cross join levels l
where d.code in ('CS', 'MIS', 'SHARED');
