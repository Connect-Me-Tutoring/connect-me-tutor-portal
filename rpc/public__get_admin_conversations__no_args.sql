CREATE OR REPLACE FUNCTION public.get_admin_conversations()
 RETURNS TABLE(conversation_id uuid, created_at timestamp with time zone, participants json)
 LANGUAGE sql
AS $function$
    SELECT 
        c.id,
        c.created_at,
        json_agg(
            json_build_object(
                'id', p.id,
                'first_name', p.first_name,
                'last_name', p.last_name
            )
        ) AS participants
    FROM conversations c
    JOIN conversation_participant cp 
        ON cp.conversation_id = c.id
    JOIN public."Profiles" p 
        ON p.id = cp.profile_id
    WHERE c.admin_conversation = true
    GROUP BY c.id, c.created_at
    ORDER BY c.created_at DESC;
$function$
