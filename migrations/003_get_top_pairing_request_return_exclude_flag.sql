-- Optional: If the pairing workflow needs exclude_rejected_tutors from the queue, alter get_top_pairing_request
-- to include it in the result set. Copy the current function from Supabase Dashboard and add the column to the
-- returned query (e.g. SELECT ..., pr.exclude_rejected_tutors).
-- Placeholder: no-op so migration runs. Replace with actual CREATE OR REPLACE FUNCTION after copying from Supabase.
SELECT 1;
