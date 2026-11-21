alter table public."Sessions"
  add column session_subject text;

alter table public."Sessions"
  add constraint sessions_session_subject_check
  check (
    session_subject is null
    or session_subject in (
      'Math',
      'Science',
      'English/ELA',
      'Social Studies',
      'World Languages',
      'Computer Science',
      'Test Prep',
      'Other'
    )
  );

comment on column public."Sessions".session_subject is
  'Subject selected on the Session Exit Form';
