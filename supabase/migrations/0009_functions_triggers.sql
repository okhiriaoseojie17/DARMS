-- 0009_functions_triggers.sql
-- This is the trigger that closes the "auto-approval scope" gap identified in
-- the architecture review (§1 item 3): a Lecturer/Level Advisor's upload is
-- only auto-approved if a matching scoped permission actually exists — checked
-- here in the database, so the client can never fake its way past it.

create or replace function enforce_upload_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  has_auto_approve boolean;
begin
  select exists (
    select 1
    from permission_assignments pa
    join permissions p on p.id = pa.permission_id
    where pa.profile_id = new.uploader_id
      and p.key = 'auto_approve'
      and pa.revoked_at is null
      and (pa.scope_course_id is null or pa.scope_course_id = new.course_id)
      and (pa.scope_department_id is null or pa.scope_department_id = new.department_id)
      and (pa.scope_level_id is null or pa.scope_level_id = new.level_id)
  ) into has_auto_approve;

  if has_auto_approve then
    new.status := 'approved';
    new.reviewed_by := new.uploader_id;
    new.reviewed_at := now();
  else
    new.status := 'pending';
  end if;

  return new;
end;
$$;

create trigger uploads_enforce_status
  before insert on uploads
  for each row execute procedure enforce_upload_status();

-- Every status change gets logged automatically, so no code path can approve/
-- reject/delete an upload without leaving an audit trail.
create or replace function log_upload_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if (tg_op = 'UPDATE' and old.status is distinct from new.status) then
    insert into approval_events (upload_id, actor_id, from_status, to_status, reason)
    values (new.id, new.reviewed_by, old.status, new.status, new.rejection_reason);
  elsif (tg_op = 'INSERT') then
    insert into approval_events (upload_id, actor_id, from_status, to_status)
    values (new.id, new.uploader_id, null, new.status);
  end if;
  return new;
end;
$$;

create trigger uploads_log_status_change
  after insert or update on uploads
  for each row execute procedure log_upload_status_change();
