CREATE OR REPLACE FUNCTION public.get_client_admin_conversations(profile_id uuid)
 RETURNS TABLE(conversation_id uuid, participants json)
 LANGUAGE sql
AS $function$
    SELECT 
        c.id AS conversation_id,
        json_agg(
            json_build_object(
                'id', p.id,
                'first_name', p.first_name,
                'last_name', p.last_name
            )
        ) FILTER (WHERE p.id <> get_client_admin_conversations.profile_id) AS participants
    FROM conversations c
    JOIN conversation_participant cp_self 
        ON cp_self.conversation_id = c.id
       AND cp_self.profile_id = get_client_admin_conversations.profile_id
    JOIN conversation_participant cp 
        ON cp.conversation_id = c.id
    JOIN public."Profiles" p 
        ON p.id = cp.profile_id
    WHERE c.admin_conversation = true
    GROUP BY c.id
    ORDER BY c.id DESC;
$function$
