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
    <Container className="max-w-[600px] mx-auto p-5">
      <Section className="bg-connect-me-blue-3 text-white p-6 text-center">
        <Text className="text-2xl font-bold m-0">
          Connect Me Free Tutoring & Mentoring
        </Text>
      </Section>

      <Section className="p-6">
        <Text className="text-connect-me-black text-base leading-relaxed mb-6 mt-0">
          Hi {recipientName},
        </Text>

        <Section className="bg-connect-me-blue-2 border-l-4 border-connect-me-blue-3 p-4 rounded-r-lg mb-6">
          <Text className="text-connect-me-black text-base leading-relaxed m-0">
            <strong>{senderName}</strong> sent you a message:
          </Text>
          <Text className="text-connect-me-black text-base leading-relaxed mt-3 mb-0 italic">
            {messagePreview}
          </Text>
        </Section>

        <Text className="text-connect-me-black text-base leading-relaxed m-0">
          <Link
            href={chatRoomUrl}
            className="text-connect-me-blue-3 font-bold underline"
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
      <Body className="font-sans m-0 p-0">
        <EmailContent />
      </Body>
    </Html>
  );
}
