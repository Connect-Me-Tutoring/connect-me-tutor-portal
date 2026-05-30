import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";

let supabaseInstance: any | null = null;

export const getSupabase =  () => {
  if (!supabaseInstance) {
    supabaseInstance = createClientComponentClient({
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL!,
      supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    });
  }

  return supabaseInstance;
};

export const supabase = getSupabase();

export const supabaseClient = supabase;
