-- 0020_submission_notifications.sql
-- Notifies the relevant reviewers immediately when a new course request or
-- upload is submitted, so admins don't have to manually poll /admin/courses
-- or /admin/review. Implemented as AFTER INSERT triggers (SECURITY DEFINER)
-- rather than in the API routes, because the submitting user's session has
-- no RLS-granted visibility into other users' permission_assignments rows —
-- only a definer function can look up "who holds this permission" safely.

create or replace function notify_course_request_reviewers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (profile_id, type, payload)
  select
    pa.profile_id,
    'course_request_submitted',
    jsonb_build_object(
      'requestId', new.id,
      'code', new.code,
      'title', new.title,
      'departmentId', new.department_id
    )
  from permission_assignments pa
  join permissions p on p.id = pa.permission_id
  where p.key = 'manage_courses'
    and pa.revoked_at is null
    and (pa.scope_department_id is null or pa.scope_department_id = new.department_id);

  return new;
end;
$$;

drop trigger if exists trg_notify_course_request_reviewers on course_creation_requests;
create trigger trg_notify_course_request_reviewers
  after insert on course_creation_requests
  for each row
  when (new.status = 'pending')
  execute function notify_course_request_reviewers();


create or replace function notify_upload_reviewers()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into notifications (profile_id, type, payload)
  select
    pa.profile_id,
    'upload_submitted',
    jsonb_build_object(
      'uploadId', new.id,
      'filename', new.generated_filename,
      'courseId', new.course_id
    )
  from permission_assignments pa
  join permissions p on p.id = pa.permission_id
  where p.key in ('approve_uploads', 'reject_uploads')
    and pa.revoked_at is null
    and (pa.scope_course_id is null or pa.scope_course_id = new.course_id)
    and (pa.scope_department_id is null or pa.scope_department_id = new.department_id)
    and (pa.scope_level_id is null or pa.scope_level_id = new.level_id);

  return new;
end;
$$;

drop trigger if exists trg_notify_upload_reviewers on uploads;
create trigger trg_notify_upload_reviewers
  after insert on uploads
  for each row
  when (new.status = 'pending')
  execute function notify_upload_reviewers();