-- 0015_scope_approved_bucket_write.sql
-- Replaces the coarse "do you hold approve_uploads anywhere" check with one
-- that ties the storage write back to the SPECIFIC upload row being
-- approved — matching its exact course/department/level against the
-- reviewer's actual scoped permission, the same way uploads_reviewer_update
-- _scoped (migration 0010) already gates the database side.

drop policy if exists "approved_bucket_reviewer_write" on storage.objects;

create policy "approved_bucket_reviewer_write_scoped"
on storage.objects for insert
with check (
  bucket_id = 'uploads-approved'
  and exists (
    select 1 from uploads u
    where u.storage_path = storage.objects.name
      and u.status = 'approved'
      and exists (
        select 1 from permission_assignments pa
        join permissions p on p.id = pa.permission_id
        where pa.profile_id = auth.uid()
          and p.key = 'approve_uploads'
          and pa.revoked_at is null
          and (pa.scope_course_id is null or pa.scope_course_id = u.course_id)
          and (pa.scope_department_id is null or pa.scope_department_id = u.department_id)
          and (pa.scope_level_id is null or pa.scope_level_id = u.level_id)
      )
  )
);
