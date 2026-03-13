import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Link,
  Section,
} from "@react-email/components";

export interface ChatMessageNotificationEmailProps {
  recipientName: string;
  senderName: string;
  messagePreview: string;
  chatRoomUrl: string;
  isPreview?: boolean;
}

export default function ChatMessageNotificationEmail({
  recipientName,
  senderName,
  messagePreview,
  chatRoomUrl,
  isPreview = false,
}: ChatMessageNotificationEmailProps) {
  const EmailContent = () => (
    <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <Section
        style={{
          backgroundColor: "#0E5B94",
          color: "#ffffff",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <Text style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
          Connect Me Free Tutoring & Mentoring
        </Text>
      </Section>

      <Section style={{ padding: "24px" }}>
        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          Hi {recipientName},
        </Text>

        <Section
          style={{
            backgroundColor: "#B7E2F2",
            borderLeft: "4px solid #6AB2D7",
            padding: "16px",
            borderRadius: "0 8px 8px 0",
            margin: "0 0 24px 0",
          }}
        >
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            <strong>{senderName}</strong> sent you a message:
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "12px 0 0 0",
              fontStyle: "italic",
            }}
          >
            {`&quot${messagePreview}&quot`}
          </Text>
        </Section>

        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0",
          }}
        >
          <Link
            href={chatRoomUrl}
            style={{
              color: "#0E5B94",
              fontWeight: "bold",
              textDecoration: "underline",
            }}
          >
            View the message
          </Link>{" "}
          to continue the conversation.
        </Text>
      </Section>
    </Container>
  );

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "Arial, sans-serif", margin: 0, padding: 0 }}>
        <EmailContent />
      </Body>
    </Html>
  );
}
