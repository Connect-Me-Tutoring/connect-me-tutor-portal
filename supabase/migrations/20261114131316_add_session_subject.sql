-- Leave existing and unsubmitted sessions without a subject. New exit form
-- submissions require a selection in the form and server action.
ALTER TABLE public."Sessions"
  ADD COLUMN subject text
  CHECK (subject IN (
    'Math',
    'Science',
    'English/ELA',
    'Social Studies',
    'World Languages',
    'Computer Science',
    'Other'
  ));

COMMENT ON COLUMN public."Sessions".subject IS 'Subject taught, selected in the Session Exit Form.';
