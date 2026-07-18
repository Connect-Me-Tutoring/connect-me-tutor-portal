-- Add exclude_rejected_tutors to pairing_requests for student preference to block tutors who previously declined them.
ALTER TABLE pairing_requests
  ADD COLUMN IF NOT EXISTS exclude_rejected_tutors boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN pairing_requests.exclude_rejected_tutors IS 'When true (default), students will not be matched with tutors who previously rejected them.';
