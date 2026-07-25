-- Backfill pairing_requests.user_id to profile id when legacy rows stored auth user id.
-- Most pairing RPCs join on pairing_requests.user_id = Profiles.id.

UPDATE public.pairing_requests pr
SET user_id = p.id
FROM public."Profiles" p
WHERE pr.user_id = p.user_id
  AND NOT EXISTS (
    SELECT 1
    FROM public."Profiles" p2
    WHERE p2.id = pr.user_id
  );

COMMENT ON TABLE public.pairing_requests IS
  'pairing_requests.user_id should reference Profiles.id; legacy auth-user-id rows are backfilled in 20260430225000.';
