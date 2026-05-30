import {
  Html,
  Head,
  Body,
  Container,
  Text,
  Link,
  Section,
} from "@react-email/components";
import { TutorMonthlyCheckInEmailProps } from "@/types/email";

export default function TutorMonthlyCheckInEmail({
  tutor,
  student,
  monthsSinceStart,
  isPreview = false,
}: TutorMonthlyCheckInEmailProps) {
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
          Hi {tutor.firstName},
        </Text>

        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 16px 0",
          }}
        >
          It's been {monthsSinceStart} month{monthsSinceStart !== 1 ? 's' : ''} since you started tutoring {student.firstName} {student.lastName}. We hope the sessions have been going well!
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
            • How are the tutoring sessions progressing?
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            • Is {student.firstName} making progress in the subjects you're covering?
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            • Are you facing any challenges??
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            • Do you need any additional resources or support?
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
          Your feedback helps us ensure the best possible experience for both tutors and students.

        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          Thank you for your dedication to mentoring and making a difference in {student.firstName}'s education!
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
