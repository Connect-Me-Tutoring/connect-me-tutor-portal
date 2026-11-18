-- Which Session Exit Form category a question/concern was filed under.
-- Keys match CATEGORY_LABELS in constants/sessionExitForm.ts.
alter table public."Sessions"
  add column if not exists question_or_concern_category text
  check (
    question_or_concern_category is null
    or question_or_concern_category in ('attendance', 'technical', 'behavior', 'urgent')
  );
