import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import {
  StudentAnnouncementsRoomId,
  TutorAnnouncementRoomId,
} from "@/constants/chat";

export type ChatRoomType = "pairing" | "announcements" | "admin";

export type ChatRecipientRow = {
  id: string;
  email: string | null;
  first_name: string;
  last_name: string;
};

/** Returns true if this profile has muted email for this room (no row = not muted). */
export async function isChatRoomEmailMuted(
  admin: SupabaseClient<Database>,
  profileId: string,
  roomId: string,
): Promise<boolean> {
  const { data } = await admin
    .from("chat_room_notification_preferences")
    .select("email_muted")
    .eq("profile_id", profileId)
    .eq("room_id", roomId)
    .maybeSingle();

  return data?.email_muted === true;
}

async function fetchProfilesByIds(
  admin: SupabaseClient<Database>,
  ids: string[],
): Promise<ChatRecipientRow[]> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return [];

  const { data, error } = await admin
    .from("Profiles")
    .select("id, email, first_name, last_name")
    .in("id", unique);

  if (error) {
    console.error("fetchProfilesByIds", error);
    return [];
  }

  return (data ?? []) as ChatRecipientRow[];
}

async function fetchAdminProfileIds(
  admin: SupabaseClient<Database>,
): Promise<string[]> {
  const { data, error } = await admin
    .from("Profiles")
    .select("id")
    .eq("role", "Admin");

  if (error) {
    console.error("fetchAdminProfileIds", error);
    return [];
  }

  return (data ?? []).map((r) => r.id);
}

export async function resolveChatRecipientProfiles(
  admin: SupabaseClient<Database>,
  roomId: string,
  roomType: ChatRoomType,
): Promise<ChatRecipientRow[]> {
  if (roomType === "pairing") {
    const { data: pairing, error } = await admin
      .from("Pairings")
      .select("student_id, tutor_id")
      .eq("id", roomId)
      .maybeSingle();

    if (error || !pairing) {
      if (error) console.error("resolveChatRecipientProfiles pairing", error);
      return [];
    }

    const adminIds = await fetchAdminProfileIds(admin);
    const ids = [pairing.student_id, pairing.tutor_id, ...adminIds];
    return fetchProfilesByIds(admin, ids);
  }

  if (roomType === "admin") {
    const { data: participants, error } = await admin
      .from("conversation_participant")
      .select("profile_id")
      .eq("conversation_id", roomId);

    if (error) {
      console.error("resolveChatRecipientProfiles admin participants", error);
      return [];
    }

    const participantIds = (participants ?? []).map((p) => p.profile_id);
    const adminIds = await fetchAdminProfileIds(admin);
    const ids = [...participantIds, ...adminIds];
    return fetchProfilesByIds(admin, ids);
  }

  if (roomType === "announcements") {
    let roleFilter: "Tutor" | "Student" | null = null;
    if (roomId === TutorAnnouncementRoomId) roleFilter = "Tutor";
    else if (roomId === StudentAnnouncementsRoomId) roleFilter = "Student";

    if (!roleFilter) return [];

    const { data, error } = await admin
      .from("Profiles")
      .select("id, email, first_name, last_name")
      .eq("role", roleFilter);

    if (error) {
      console.error("resolveChatRecipientProfiles announcements", error);
      return [];
    }

    return (data ?? []) as ChatRecipientRow[];
  }

  return [];
}

export function buildChatRoomUrl(
  siteUrl: string,
  roomType: ChatRoomType,
  roomId: string,
): string {
  const base = siteUrl.replace(/\/$/, "");
  if (roomType === "pairing") {
    return `${base}/dashboard/pairings/${roomId}/chat`;
  }
  if (roomType === "admin") {
    return `${base}/dashboard/chats/${roomId}`;
  }
  return `${base}/dashboard/announcements`;
}
