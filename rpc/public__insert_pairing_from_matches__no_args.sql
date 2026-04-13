CREATE OR REPLACE FUNCTION public.insert_pairing_from_matches()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.tutor_status = 'accepted' THEN
    INSERT INTO public."Pairings"(student_id, tutor_id)
    VALUES (NEW.student_id, NEW.tutor_id);
  END IF;
  RETURN NEW;
END;
$function$
