-- 0011_storage_buckets.sql
-- Supabase Storage — two buckets matching the pending/approved split
-- described in §7 of the architecture doc.
--
-- NOTE: if you already applied this migration earlier (it was delivered
-- with the browsing-pages update), make sure this file still exists in your
-- own supabase/migrations folder before running `supabase db push` again —
-- it's included here again only as a safety net in case it went missing.

insert into storage.buckets (id, name, public)
values ('uploads-pending', 'uploads-pending', false)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('uploads-approved', 'uploads-approved', true)
on conflict (id) do nothing;

-- Superseded by migration 0013, which tightens this to the uploader's own
-- folder — kept here so the two migrations apply cleanly in sequence.
create policy "pending_bucket_owner_insert"
on storage.objects for insert
with check (
  bucket_id = 'uploads-pending'
  and auth.uid() is not null
);

create policy "pending_bucket_owner_read"
on storage.objects for select
using (
  bucket_id = 'uploads-pending'
  and exists (
    select 1 from uploads u
    where u.storage_path = storage.objects.name
      and (
        u.uploader_id = auth.uid()
        or exists (
          select 1 from permission_assignments pa
          join permissions p on p.id = pa.permission_id
          where pa.profile_id = auth.uid()
            and p.key in ('approve_uploads', 'reject_uploads', 'delete_uploads')
            and pa.revoked_at is null
            and (pa.scope_course_id is null or pa.scope_course_id = u.course_id)
            and (pa.scope_department_id is null or pa.scope_department_id = u.department_id)
            and (pa.scope_level_id is null or pa.scope_level_id = u.level_id)
        )
      )
  )
);

create policy "approved_bucket_reviewer_write"
on storage.objects for insert
with check (
  bucket_id = 'uploads-approved'
  and exists (
    select 1 from permission_assignments pa
    join permissions p on p.id = pa.permission_id
    where pa.profile_id = auth.uid()
      and p.key = 'approve_uploads'
      and pa.revoked_at is null
  )
);
