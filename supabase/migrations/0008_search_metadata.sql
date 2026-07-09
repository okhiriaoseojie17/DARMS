-- 0008_search_metadata.sql
-- Full-text search + metadata columns, added now while the uploads table is
-- still empty — far cheaper than retrofitting once real rows exist.

alter table uploads add column extracted_text tsvector;
alter table uploads add column tags text[] default '{}';
alter table uploads add column description text;
alter table uploads add column estimated_reading_time_minutes int;
alter table uploads add column lecturer_verified boolean not null default false;

create index uploads_extracted_text_idx on uploads using gin (extracted_text);
create index uploads_tags_idx on uploads using gin (tags);

-- Trigram search support for course titles/labels (non-content search)
create extension if not exists pg_trgm;
create index courses_title_trgm_idx on courses using gin (title gin_trgm_ops);
create index uploads_display_label_trgm_idx on uploads using gin (display_label gin_trgm_ops);
