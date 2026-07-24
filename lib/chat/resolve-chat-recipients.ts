import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";
import { StudentAnnouncementsRoomId, TutorAnnouncementRoomId } from "@/constants/chat";
import { logError } from "@/lib/posthog";

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
    .select("id, user_id, email, first_name, last_name")
    .in("id", unique);

  if (error) {
    console.error("fetchProfilesByIds", error);
    await logError(error, { ids }, "chat_resolve_recipients_error");
    return [];
  }

  const rows = (data ?? []) as Array<ChatRecipientRow & { user_id: string | null }>;
  const missingEmailRows = rows.filter((r) => !r.email && r.user_id);

  if (missingEmailRows.length === 0) {
    return rows.map((r) => ({
      id: r.id,
      email: r.email,
      first_name: r.first_name,
      last_name: r.last_name,
    }));
  }

  const userIds = [...new Set(missingEmailRows.map((r) => r.user_id!))];
  const { data: userSettingsRows, error: settingsError } = await admin
    .from("user_settings")
    .select("user_id, email")
    .in("user_id", userIds);

  if (settingsError) {
    console.error("fetchProfilesByIds user_settings fallback", settingsError);
    await logError(settingsError, { userIds }, "chat_resolve_recipients_error");
  }

  const userIdToEmail = new Map(
    (userSettingsRows ?? [])
      .filter((r) => r.user_id && r.email)
      .map((r) => [r.user_id as string, r.email as string]),
  );

  const withFallback = rows.map((r) => ({
    id: r.id,
    email: r.email ?? (r.user_id ? (userIdToEmail.get(r.user_id) ?? null) : null),
    first_name: r.first_name,
    last_name: r.last_name,
  }));

  return withFallback;
}

async function fetchAdminProfileIds(admin: SupabaseClient<Database>): Promise<string[]> {
  const { data, error } = await admin.from("Profiles").select("id").eq("role", "Admin");

  if (error) {
    console.error("fetchAdminProfileIds", error);
    await logError(error, {}, "chat_resolve_recipients_error");
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
      if (error) {
        console.error("resolveChatRecipientProfiles pairing", error);
        await logError(error, { roomId, roomType }, "chat_resolve_recipients_error");
      }
      return [];
    }

    // const adminIds = await fetchAdminProfileIds(admin);
    const ids = [pairing.student_id, pairing.tutor_id];
    return fetchProfilesByIds(admin, ids);
  }

  if (roomType === "admin") {
    const { data: participants, error } = await admin
      .from("conversation_participant")
      .select("profile_id")
      .eq("conversation_id", roomId);

    if (error) {
      console.error("resolveChatRecipientProfiles admin participants", error);
      await logError(error, { roomId, roomType }, "chat_resolve_recipients_error");
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

    const { data, error } = await admin.from("Profiles").select("id").eq("role", roleFilter);

    if (error) {
      console.error("resolveChatRecipientProfiles announcements", error);
      await logError(error, { roomId, roomType }, "chat_resolve_recipients_error");
      return [];
    }

    const ids = (data ?? []).map((profile) => profile.id);
    return fetchProfilesByIds(admin, ids);
  }

  return [];
}

export function buildChatRoomUrl(siteUrl: string, roomType: ChatRoomType, roomId: string): string {
  const base = siteUrl.replace(/\/$/, "");
  if (roomType === "pairing") {
    return `${base}/dashboard/pairings/${roomId}/chat`;
  }
  if (roomType === "admin") {
    return `${base}/dashboard/chats/${roomId}`;
  }
  return `${base}/dashboard/announcements`;
}
