import { createAdminClient } from "@/lib/supabase/server";
import { sendChatMessageNotificationEmail } from "@/lib/actions/email.server.actions";
import {
  buildChatRoomUrl,
  isChatRoomEmailMuted,
  resolveChatRecipientProfiles,
  type ChatRoomType,
} from "@/lib/chat/resolve-chat-recipients";

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
    const recipients = await resolveChatRecipientProfiles(
      admin,
      roomId,
      roomType,
    );

    const senderName =
      `${senderFirstName} ${senderLastName}`.trim() || "Someone";
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.connectmego.app";
    const chatRoomUrl = buildChatRoomUrl(siteUrl, roomType, roomId);
    const preview =
      messagePreview.length > 500
        ? `${messagePreview.slice(0, 497)}...`
        : messagePreview;

    for (const r of recipients) {
      if (r.id === senderProfileId) continue;
      if (!r.email) continue;

      const muted = await isChatRoomEmailMuted(admin, r.id, roomId);
      if (muted) continue;

      await sendChatMessageNotificationEmail({
        to: r.email,
        recipientName: `${r.first_name} ${r.last_name}`.trim(),
        senderName,
        messagePreview: preview,
        chatRoomUrl,
      });
    }
  } catch (e) {
    console.error("dispatchChatMessageEmails", e);
  }
}
