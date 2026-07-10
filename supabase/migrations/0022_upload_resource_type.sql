-- 0022_upload_resource_type.sql
-- generateFilename()/createUploadSchema already computed a "resourceType"
-- for every upload (notes/test/assignment/exam/other), but POST /api/uploads
-- never actually saved it to the uploads row — it only used it to build
-- generated_filename/display_label, then discarded it. That left no
-- reliable column to group uploads into category folders on the course page.
--
-- Also splitting the old generic 'test' into 'test1'/'test2': CU courses
-- always have exactly two named continuous-assessment tests, so this makes
-- "which folder" a plain enum value instead of parsing a free-text label
-- ("1", "Test 1", "First CA"...) that a student typed by hand.
--
-- Note: if there are already real uploads in the table with the old
-- resourceType='test' behavior, they'll default to 'other' below and need
-- manual reclassification — there's no way to recover which test number
-- they were from data alone.

alter table uploads add column resource_type text
  check (resource_type in ('notes','test1','test2','assignment','exam','other'))
  not null default 'other';

create index uploads_resource_type_idx on uploads (course_id, resource_type);
