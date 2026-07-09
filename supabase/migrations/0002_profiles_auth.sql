-- 0002_profiles_auth.sql
-- Profiles auto-created on signup. Email domain is enforced server-side here —
-- this fires regardless of what Google's own Workspace restriction already did,
-- so a compromised or misconfigured OAuth screen can never let a wrong domain in.

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null,
  email text not null unique,
  avatar_url text,
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table allowed_email_domains (
  domain text primary key
);

insert into allowed_email_domains (domain) values
  ('stu.cu.edu.ng'),
  ('covenantuniversity.edu.ng'),
  ('cu.edu.ng');

create table profile_departments (
  profile_id uuid references profiles(id) on delete cascade,
  department_id uuid references departments(id) on delete cascade,
  primary key (profile_id, department_id)
);

create table profile_levels (
  profile_id uuid references profiles(id) on delete cascade,
  level_id uuid references levels(id) on delete cascade,
  primary key (profile_id, level_id)
);

-- Enforce allowed domains + auto-create the profile row on every new signup.
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  email_domain text;
begin
  email_domain := split_part(new.email, '@', 2);

  if not exists (select 1 from allowed_email_domains where domain = email_domain) then
    raise exception 'Sign-up rejected: % is not an approved Covenant University email domain', email_domain;
  end if;

  insert into profiles (id, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.email
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();
