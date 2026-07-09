-- 0018_fix_permission_assignments_recursion.sql
-- Fixes: "infinite recursion detected in policy for relation
-- permission_assignments" (Postgres error 42P17).
--
-- Root cause: permission_assignments_manager_read/insert (0010) queried
-- permission_assignments FROM WITHIN their own USING/WITH CHECK clause to
-- check for manage_permissions. Since RLS applies to every query against the
-- table -- including ones run from inside its own policies -- that inner
-- query re-triggered the same policy, which queried the table again, and so
-- on forever.
--
-- Fix: move the "does this user hold manage_permissions" check into a
-- SECURITY DEFINER function. Such functions run with the privileges of the
-- function owner and bypass RLS for their internal queries, so the check no
-- longer re-enters the policy it's being used by.

create or replace function current_user_has_manage_permissions()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1
    from permission_assignments pa
    join permissions p on p.id = pa.permission_id
    where pa.profile_id = auth.uid()
      and p.key = 'manage_permissions'
      and pa.revoked_at is null
  );
$$;

drop policy if exists "permission_assignments_manager_read" on permission_assignments;
create policy "permission_assignments_manager_read" on permission_assignments
  for select using (current_user_has_manage_permissions());

drop policy if exists "permission_assignments_manager_insert" on permission_assignments;
create policy "permission_assignments_manager_insert" on permission_assignments
  for insert with check (current_user_has_manage_permissions());
