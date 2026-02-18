"use server";

import crypto from "crypto";
import { createClient } from "../supabase/server";
import { AdminConversation } from "@/types/chat";
import { getUserFromAction } from "./user.server.actions";
import { getUserFromId } from "./admin.actions";
import { getProfileFromUserSettings } from "./user.actions";

export const createAdminConversation = async (user_id: string) => {
  const supabase = await createClient();

  const createdConversationID = await fetchUserAdminConversation(
    user_id,
    false,
  );

  // const { data: profileData, error } = await supabase
  //   .from("Profiles")
  //   .select("id")
  //   .eq("user_id", user_id)
  //   .single();
  // if (error) throw error;

  const profileData = await getProfileFromUserSettings(user_id);
  const profile_id = profileData.id;

  // const user = await getUserFromId(profile_id);
  // if (!user) throw new Error("failed to locate profile");

  if (createdConversationID) return createdConversationID;

  const conversationID = crypto.randomUUID();
  const result = await supabase.from("conversations").insert([
    {
      id: conversationID,
      admin_conversation: true,
    },
  ]);

  if (result.error) return console.error(result.error);

  const createdParticipantResult = await supabase
    .from("conversation_participant")
    .insert([
      {
        conversation_id: conversationID,
        profile_id,
      },
    ]);

  return conversationID;
};

export async function fetchUserAdminConversation(
  userId: string,
  createIfNull: boolean = true,
) {
  try {
    const supabase = await createClient();
    const profile = await getProfileFromUserSettings(userId);

    const profileId = profile.id;

    const { data, error } = await supabase
      .rpc("get_client_admin_conversations", {
        profile_id: profileId,
      })
      .single();

    const result = data as AdminConversation;

    if (result) return result.conversation_id;
    if (createIfNull) await createAdminConversation(userId);
    return null;
  } catch (error) {
    console.error("Unable to fetch user admin conversations", error);
    throw error;
  }
}
export async function fetchAdmins() {
  const supabase = await createClient();
  try {
    const { data, error } = await supabase
      .from("Profiles")
      .select("*")
      .eq("role", "Admin");
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("unable to fetch admin information");
  }
}
