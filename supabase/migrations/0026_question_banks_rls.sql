-- 0026_question_banks_rls.sql
-- Generated question banks are private to the person who generated them.
-- No course-wide sharing — each student's AI-generated practice set is
-- their own, consistent with content being generated on-demand per request
-- rather than being a shared course resource like an approved upload.

alter table question_banks enable row level security;

create policy "question_banks_select_own"
on question_banks for select
using (generated_by = auth.uid());

create policy "question_banks_insert_own"
on question_banks for insert
with check (generated_by = auth.uid());

-- No update policy: generated content is immutable once created, same
-- principle as approved uploads. Regenerating just creates a new row.

create policy "question_banks_delete_own"
on question_banks for delete
using (generated_by = auth.uid());
