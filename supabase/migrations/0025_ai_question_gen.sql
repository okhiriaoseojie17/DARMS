-- Adds a category label so the AI tab knows which upload pool a question bank
-- was generated from, without re-deriving it from source_upload_ids every time.

alter table question_banks
  add column source_category text not null default 'notes'
  check (source_category in ('test1', 'test2', 'exam', 'notes'));

-- Fast lookup: "show me the most recent question bank for this course + category"
create index question_banks_course_category_idx
  on question_banks (course_id, source_category, generated_at desc);
