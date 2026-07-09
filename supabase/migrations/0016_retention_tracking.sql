-- 0016_retention_tracking.sql
-- Without an explicit bucket column, the purge job would have to infer
-- "pending vs approved" from status history, which is fragile once
-- archive/restore cycles happen. Tracking it directly instead.

alter table uploads add column storage_bucket text
  check (storage_bucket in ('uploads-pending', 'uploads-approved'));
alter table uploads add column purged_at timestamptz;

-- Backfill for any rows created before this migration (harmless if empty).
update uploads
set storage_bucket = case
  when status = 'approved' then 'uploads-approved'
  when storage_path is not null then 'uploads-pending'
  else null
end
where storage_bucket is null;
