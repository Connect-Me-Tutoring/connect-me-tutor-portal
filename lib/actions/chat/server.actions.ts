"use server";

import crypto from "crypto";
import type { Profile } from "@/types";
import type { Json } from "@/types/database.types";
import {
  ChatFileBucket,
  ChatRateLimitMaxMessages,
  ChatRateLimitWindowSeconds,
  StudentAnnouncementsRoomId,
  TutorAnnouncementRoomId,
} from "@/constants/chat";
import { dispatchChatMessageEmails } from "@/lib/chat/dispatch-chat-message-emails";
import { validateChatMessage } from "@/lib/chat/validate-chat-message";
import type { ChatRoomType } from "@/lib/chat/resolve-chat-recipients";
import { createAdminClient, createClient } from "../../supabase/server";
import { AdminConversation } from "@/types/chat";
import { getProfileFromUserSettings } from "../profile/server.actions";
import { getUserFromAction } from "../user/server.actions";
import { requireAuthenticatedUser, requireSelfOrAdmin } from "../auth/authz.server";
import { logError } from "@/lib/posthog";

export const createAdminConversation = async (user_id: string) => {
  await requireSelfOrAdmin(user_id);
  const supabase = await createClient();

  const createdConversationID = await fetchUserAdminConversation(user_id, false);

  const profileData = await getProfileFromUserSettings(user_id);
  if (!profileData) return null;
  const profile_id = profileData.id;

  if (createdConversationID) return createdConversationID;

  const conversationID = crypto.randomUUID();
  const result = await supabase.from("conversations").insert([
    {
      id: conversationID,
      admin_conversation: true,
    },
  ]);

  if (result.error) {
    console.error(result.error);
    await logError(
      result.error,
      { action: "createAdminConversation", userId: user_id },
      "chat_error",
    );
    return;
  }

  const createdParticipantResult = await supabase.from("conversation_participant").insert([
    {
      conversation_id: conversationID,
      profile_id,
    },
  ]);

  return conversationID;
};

export async function fetchUserAdminConversation(userId: string, createIfNull: boolean = true) {
  await requireSelfOrAdmin(userId);
  const supabase = await createClient();
  try {
    const profile = await getProfileFromUserSettings(userId);
    if (!profile) return null;

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
    await logError(error, { action: "fetchUserAdminConversation", userId }, "chat_error");
    throw error;
  }
}
export async function fetchAdmins() {
  await requireAuthenticatedUser();
  const supabase = await createClient();
  try {
    const { data, error } = await supabase.from("Profiles").select("*").eq("role", "Admin");
    if (error) throw error;
    return data;
  } catch (error) {
    console.error("unable to fetch admin information");
    await logError(error, { action: "fetchAdmins" }, "chat_error");
  }
}

async function assertCanSendChatMessage(
  supabase: Awaited<ReturnType<typeof createClient>>,
  profile: Profile,
  roomId: string,
  roomType: ChatRoomType,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (roomType === "announcements") {
    if (profile.role !== "Admin") {
      return { ok: false, message: "Only admins can post to announcements" };
    }
    if (roomId !== StudentAnnouncementsRoomId && roomId !== TutorAnnouncementRoomId) {
      return { ok: false, message: "Invalid announcements room" };
    }
    return { ok: true };
  }

  if (roomType === "pairing") {
    const { data, error } = await supabase
      .from("Pairings")
      .select("id, student_id, tutor_id")
      .eq("id", roomId)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, message: "Pairing not found" };
    }
    if (data.student_id !== profile.id && data.tutor_id !== profile.id) {
      return { ok: false, message: "Not a participant in this pairing chat" };
    }
    return { ok: true };
  }

  if (roomType === "admin") {
    if (profile.role === "Admin") {
      return { ok: true };
    }
    const { data, error } = await supabase
      .from("conversation_participant")
      .select("profile_id")
      .eq("conversation_id", roomId)
      .eq("profile_id", profile.id)
      .maybeSingle();

    if (error || !data) {
      return { ok: false, message: "Not a participant in this conversation" };
    }
    return { ok: true };
  }

  return { ok: false, message: "Invalid room type" };
}

// Counted with the admin client so the window cannot be narrowed by RLS
// visibility; a failed count allows the send rather than blocking chat.
async function isChatSendRateLimited(profileId: string): Promise<boolean> {
  const admin = await createAdminClient();
  const windowStart = new Date(Date.now() - ChatRateLimitWindowSeconds * 1000).toISOString();

  const { count, error } = await admin
    .from("messages")
    .select("id", { count: "exact", head: true })
    .eq("user_id", profileId)
    .gte("created_at", windowStart);

  if (error) {
    console.error("isChatSendRateLimited", error);
    await logError(error, { action: "sendChatMessage", profileId }, "chat_error");
    return false;
  }

  return (count ?? 0) >= ChatRateLimitMaxMessages;
}

export async function sendChatMessage(params: {
  roomId: string;
  roomType: ChatRoomType;
  content: string;
  file?: {
    name: string;
    url: string;
    type: string;
    size: number;
  } | null;
}): Promise<{ ok: boolean; error?: string }> {
  const user = await getUserFromAction();
  if (!user) return { ok: false, error: "Not authenticated" };

  const profile = await getProfileFromUserSettings(user.id);
  if (!profile) return { ok: false, error: "No profile" };

  const validated = validateChatMessage({
    content: params.content,
    file: params.file,
    storagePublicUrlPrefix: `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1/object/public/${ChatFileBucket}/`,
  });
  if (!validated.ok) return { ok: false, error: validated.message };

  const supabase = await createClient();
  const auth = await assertCanSendChatMessage(supabase, profile, params.roomId, params.roomType);
  if (!auth.ok) return { ok: false, error: auth.message };

  if (await isChatSendRateLimited(profile.id)) {
    return {
      ok: false,
      error: "You are sending messages too quickly. Wait a moment and try again.",
    };
  }

  const newMessage: {
    room_id: string;
    user_id: string;
    content: string;
    file?: Json;
  } = {
    room_id: params.roomId,
    user_id: profile.id,
    content: validated.content,
  };

  if (validated.file) {
    newMessage.file = validated.file as unknown as Json;
  }

  const { error } = await supabase.from("messages").insert([newMessage]);
  if (error) {
    console.error("sendChatMessage insert", error);
    await logError(
      error,
      { action: "sendChatMessage", roomId: params.roomId, roomType: params.roomType },
      "chat_error",
    );
    return { ok: false, error: error.message };
  }

  const preview =
    validated.content || (validated.file ? `Shared a file: ${validated.file.name}` : "");

  await dispatchChatMessageEmails({
    roomId: params.roomId,
    roomType: params.roomType,
    senderProfileId: profile.id,
    senderFirstName: profile.firstName,
    senderLastName: profile.lastName,
    messagePreview: preview,
  });

  return { ok: true };
}

export async function getChatRoomEmailMutedState(roomId: string): Promise<{ muted: boolean }> {
  const user = await getUserFromAction();
  if (!user) return { muted: false };

  const profile = await getProfileFromUserSettings(user.id);
  if (!profile) return { muted: false };

  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_room_notification_preferences")
    .select("email_muted")
    .eq("profile_id", profile.id)
    .eq("room_id", roomId)
    .maybeSingle();

  return { muted: data?.email_muted === true };
}

export async function setChatRoomEmailMuted(
  roomId: string,
  muted: boolean,
): Promise<{ ok: boolean; error?: string }> {
  const user = await getUserFromAction();
  if (!user) return { ok: false, error: "Not authenticated" };

  const profile = await getProfileFromUserSettings(user.id);
  if (!profile) return { ok: false, error: "No profile" };

  const supabase = await createClient();

  const { error } = await supabase.from("chat_room_notification_preferences").upsert(
    {
      profile_id: profile.id,
      room_id: roomId,
      email_muted: muted,
    },
    { onConflict: "profile_id,room_id" },
  );

  if (error) {
    console.error("setChatRoomEmailMuted", error);
    await logError(error, { action: "setChatRoomEmailMuted", roomId, muted }, "chat_error");
    return { ok: false, error: error.message };
  }

  return { ok: true };
}
