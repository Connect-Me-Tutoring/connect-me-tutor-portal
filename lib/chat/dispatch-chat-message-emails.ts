import { createAdminClient } from "@/lib/supabase/server";
import { ChatEmailDebounceSeconds } from "@/constants/chat";
import { sendChatMessageNotificationEmail } from "@/lib/actions/email/server.actions";
import {
  buildChatRoomUrl,
  isChatRoomEmailMuted,
  resolveChatRecipientProfiles,
  type ChatRoomType,
} from "@/lib/chat/resolve-chat-recipients";
import { logError } from "@/lib/posthog";

type DispatchArgs = {
  roomId: string;
  roomType: ChatRoomType;
  senderProfileId: string;
  senderFirstName: string;
  senderLastName: string;
  messagePreview: string;
};

export async function dispatchChatMessageEmails({
  roomId,
  roomType,
  senderProfileId,
  senderFirstName,
  senderLastName,
  messagePreview,
}: DispatchArgs): Promise<void> {
  try {
    const admin = await createAdminClient();

    // The message being dispatched is already inserted, so a count above one
    // means this sender already triggered an email round for this room within
    // the debounce window. Keyed off message rows, not delivered emails: if a
    // round fully fails despite the per-send retries below, it is not retried
    // until the window lapses — accepted, since messages stay visible in-app.
    // Announcements are exempt: admin-only and intentional.
    if (roomType !== "announcements") {
      const debounceStart = new Date(Date.now() - ChatEmailDebounceSeconds * 1000).toISOString();
      const { count, error } = await admin
        .from("messages")
        .select("id", { count: "exact", head: true })
        .eq("room_id", roomId)
        .eq("user_id", senderProfileId)
        .gte("created_at", debounceStart);

      if (!error && (count ?? 0) > 1) return;
    }

    const recipients = await resolveChatRecipientProfiles(admin, roomId, roomType);

    const senderName = `${senderFirstName} ${senderLastName}`.trim() || "Someone";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.connectmego.app";
    const chatRoomUrl = buildChatRoomUrl(siteUrl, roomType, roomId);
    const preview =
      messagePreview.length > 500 ? `${messagePreview.slice(0, 497)}...` : messagePreview;

    for (const r of recipients) {
      if (r.id === senderProfileId) continue;
      if (!r.email) continue;

      // One recipient's failure must not abandon the rest of the round: the
      // debounce above would suppress a retry for the whole window.
      try {
        const muted = await isChatRoomEmailMuted(admin, r.id, roomId);
        if (muted) continue;

        await sendChatMessageNotificationEmail({
          to: r.email,
          recipientName: `${r.first_name} ${r.last_name}`.trim(),
          senderName,
          messagePreview: preview,
          chatRoomUrl,
        });
      } catch (recipientError) {
        console.error("dispatchChatMessageEmails recipient", recipientError);
        await logError(
          recipientError,
          { roomId, roomType, recipientId: r.id },
          "chat_dispatch_email_error",
        );
      }
    }
  } catch (e) {
    console.error("dispatchChatMessageEmails", e);
    await logError(e, { roomId, roomType }, "chat_dispatch_email_error");
  }
}
