CREATE OR REPLACE FUNCTION public.insert_user_settings()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
  INSERT INTO user_settings(user_id, last_active_profile_id, email)
  VALUES (NEW.user_id, NEW.id, NEW.email)
  ON CONFLICT(user_id)
  DO NOTHING;

  RETURN NEW;
END;$function$
