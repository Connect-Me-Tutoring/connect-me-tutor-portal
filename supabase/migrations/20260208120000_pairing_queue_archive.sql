-- Pairing queue archive + match rejection timestamps
-- Apply in Supabase SQL Editor or via supabase db push.

ALTER TABLE pairing_requests
  ADD COLUMN IF NOT EXISTS in_queue boolean NOT NULL DEFAULT true;

COMMENT ON COLUMN pairing_requests.in_queue IS
  'When false, the request is archived (left queue) but the row is kept for notes/history.';

ALTER TABLE pairing_matches
  ADD COLUMN IF NOT EXISTS rejected_at timestamptz;

COMMENT ON COLUMN pairing_matches.rejected_at IS
  'Set when tutor_status becomes rejected; used for re-match cooldown.';

CREATE INDEX IF NOT EXISTS idx_pairing_matches_student_tutor_status
  ON pairing_matches (student_id, tutor_id, tutor_status);

-- Env (Vercel / .env.local): PAIRING_REJECTION_COOLDOWN_DAYS=30 | never | -1
-- App reads this in lib/pairing/rejection-config.ts for client-side tutor exclusion
-- until RPCs enforce cooldown in SQL.
--
-- Manual follow-up in Supabase SQL editor: update RPC definitions to:
-- - get_all_pairing_requests / get_top_pairing_request: WHERE pairing_requests.in_queue IS NOT FALSE
-- - get_pairing_matches_with_profiles: exclude tutor_status = 'rejected' (and 'accepted') from inbox
-- - get_best_match: exclude (student_id, tutor_id) pairs blocked by recent pairing_matches rejection
--   (see supabase/migrations/20260208120001_pairing_rpc_notes.sql)
