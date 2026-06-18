"use server";

import { cookies } from "next/headers";
import { cache } from "react";
import { createServerActionClient } from "@supabase/auth-helpers-nextjs";
import { tableToInterfaceProfiles } from "../type-utils";
import { createClient } from "../supabase/server";

export async function getUserFromAction() {
  const supabase = createServerActionClient({ cookies });

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  return user;
}

export const getUser = async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
};

export const cachedGetUser = cache(getUser);

export const getProfileRole = async (userId: string): Promise<string | null> => {
  const supabase = await createClient();
  const { data } = await supabase
    .from("user_settings")
    .select("profile:Profiles!last_active_profile_id(role)")
    .eq("user_id", userId)
    .single();
  return (data?.profile as any)?.role ?? null;
};
