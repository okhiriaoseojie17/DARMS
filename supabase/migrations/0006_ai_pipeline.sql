-- 0006_ai_pipeline.sql
-- Kept isolated from the rest of the schema so the AI feature can be built,
-- deployed, and even left dormant without touching any other module.

create table ai_processing_jobs (
  id uuid primary key default gen_random_uuid(),
  upload_id uuid not null references uploads(id) on delete cascade,
  status text not null default 'queued',
  ocr_confidence numeric,
  readability_score numeric,
  resolution_ok boolean,
  rotation_detected boolean,
  missing_pages boolean,
  extractable_text boolean,
  suitable_for_question_gen boolean,
  warnings text[],
  processed_at timestamptz
);

create table question_banks (
  id uuid primary key default gen_random_uuid(),
  course_id uuid not null references courses(id),
  source_upload_ids uuid[] not null,
  difficulty text not null,
  question_type text not null,
  content jsonb not null,
  generated_by uuid references profiles(id),
  generated_at timestamptz not null default now()
);
