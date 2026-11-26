import React from "react";
import {
  EmailButton,
  EmailCallout,
  EmailHeading,
  EmailLayout,
  EmailPanel,
  EmailText,
} from "@/components/emails/layout/components";
import { emailColors } from "@/components/emails/layout/tokens";

export interface ChatMessageNotificationEmailProps {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  chatRoomUrl: string;
  /** Marks the email as a sample notification rather than a live message. */
  isPreview?: boolean;
}

export default function ChatMessageNotificationEmail({
  recipientName,
  senderName,
  messagePreview,
  chatRoomUrl,
  isPreview = false,
}: ChatMessageNotificationEmailProps) {
  return (
    <EmailLayout preview={`${senderName} sent you a message`}>
      {isPreview ? (
        <EmailCallout tone="warning">
          Preview — this is a sample notification, not a live message.
        </EmailCallout>
      ) : null}

      <EmailHeading>New message from {senderName}</EmailHeading>

      <EmailText>Hi {recipientName},</EmailText>

      <EmailPanel
        title={
          <>
            <strong>{senderName}</strong> sent you a message:
          </>
        }
      >
        <EmailText
          style={{
            margin: 0,
            fontStyle: "italic",
            whiteSpace: "pre-wrap",
            color: emailColors.gray2,
          }}
        >
          {messagePreview}
        </EmailText>
      </EmailPanel>

      <EmailButton href={chatRoomUrl}>View the message</EmailButton>
      <EmailText muted small style={{ margin: 0 }}>
        Open the chat to continue the conversation.
      </EmailText>
    </EmailLayout>
  );
}
