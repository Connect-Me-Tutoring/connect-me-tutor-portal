CREATE OR REPLACE FUNCTION public.get_user_by_email(email text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
AS $function$
BEGIN
  RETURN (
    SELECT jsonb_build_object('id', au.id)
    FROM auth.users AS au
    WHERE au.email = $1
    LIMIT 1
  );
END;
$function$
