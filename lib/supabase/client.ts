import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

let supabaseInstance: SupabaseClient | null = null;

export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}

export const getSupabase = () => {
  if (!supabaseInstance) {
    supabaseInstance = createClient();
  }
  return supabaseInstance;
};

export const supabase = getSupabase();
export const supabaseClient = supabase;
