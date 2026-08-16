-- Add orientation quiz completion tracking to Profiles
ALTER TABLE "Profiles"
  ADD COLUMN orientation_completed_at TIMESTAMPTZ DEFAULT NULL;

-- Backfill all existing active tutors so they aren't locked out
UPDATE "Profiles"
  SET orientation_completed_at = NOW()
  WHERE role = 'Tutor' AND status = 'Active';
