import "server-only";
import { createClient } from "@/lib/supabase/server";
import { cache } from "react";

export const getUser = async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
};

export const cachedGetUser = cache(getUser);
