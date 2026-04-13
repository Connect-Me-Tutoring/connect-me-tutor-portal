CREATE OR REPLACE FUNCTION public."Automatic create settings for new profiles"()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$BEGIN
    INSERT INTO public.user_notification_settings DEFAULT VALUES
    RETURNING id INTO NEW.settings_id;
    RETURN NEW;
END;$function$
