import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Link,
  Section,
} from "@react-email/components";
import { ParentMonthlyCheckInEmailProps } from "@/types/email";

export default function ParentMonthlyCheckInEmail({
  parentName,
  parentEmail,
  student,
  tutor,
  monthsSinceStart,
  isPreview = false,
}: ParentMonthlyCheckInEmailProps) {
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
          Hi {parentName},
        </Text>

        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 16px 0",
          }}
        >
          It's been {monthsSinceStart} month{monthsSinceStart !== 1 ? 's' : ''} since {student.firstName} started tutoring sessions with {tutor.firstName} {tutor.lastName}. We hope everything has been going smoothly!
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
              margin: "0 0 12px 0",
              fontWeight: "bold",
            }}
          >
            Monthly Check-In Questions:
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            • How has {student.firstName}'s experience been with the tutoring sessions?
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            • Is {student.firstName} enjoying working with {tutor.firstName}?
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            • Have you noticed any improvements in {student.firstName}'s academic performance or confidence?
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            • Are there any concerns or suggestions you'd like to share?
          </Text>
        </Section>

        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 16px 0",
          }}
        >
          Your feedback is invaluable in helping us provide the best possible tutoring experience for your child. Please don't hesitate to contact us with any thought or concerns you may have
        </Text>

        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          Thank you for being part of the Connect Me community and supporting your child's education!
        </Text>

        <Text
          style={{
            color: "#040405",
            fontSize: "14px",
            lineHeight: "1.4",
            margin: "0",
          }}
        >
          Best regards,<br />
          The Connect Me Team<br />
          <Link
            href="mailto:support@connectme.org"
            style={{
              color: "#0E5B94",
              textDecoration: "underline",
            }}
          >
            support@connectme.org
          </Link>
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