CREATE OR REPLACE FUNCTION public.get_profile_pairing_queue_state(
  p_profile_id uuid
)
RETURNS boolean
LANGUAGE sql
STABLE
AS $$
  SELECT pr.in_queue
  FROM public.pairing_requests pr
  WHERE pr.user_id = p_profile_id
  ORDER BY pr.created_at DESC
  LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_profile_pairing_queue_state(uuid) IS
  'Returns the latest pairing_requests.in_queue value for a profile, or null when no request exists.';
