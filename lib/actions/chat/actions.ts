// lib/admins.actions.ts

// lib/student.actions.ts
import { AdminConversation } from "@/types/chat";
import { supabase } from "@/lib/supabase/client";

export async function fetchAdminConversations() {
  const { data, error } = await supabase.rpc("get_admin_conversations");
  return data as unknown as AdminConversation[];
}
