import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";
import React from "react";

export interface MonthlyCheckInEmailProps {
  firstName: string;
  role: "tutor" | "student" | "parent";
  portalUrl?: string;
  isPreview?: boolean;
}

const DEFAULT_PORTAL = "https://www.connectmego.app/";

export default function MonthlyCheckInEmail({
  firstName = "User",
  role = "tutor",
  portalUrl = DEFAULT_PORTAL,
  isPreview = false,
}: MonthlyCheckInEmailProps) {
  const greeting = `Dear ${firstName},`;
  const previewText = "Your Monthly Connect Me Check-In!";

  const EmailContent = () => (
    <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      <Section
        style={{
          backgroundColor: "#0E5B94",
          color: "#ffffff",
          padding: "24px",
          textAlign: "center",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <Text style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
          Connect Me Monthly Check-In
        </Text>
      </Section>

      <Section style={{ padding: "24px", backgroundColor: "#f9fbfd" }}>
        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          {greeting}
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
            Another month has flown by! We just wanted to check in to see how your 
            tutoring sessions are going. Whether everything is running smoothly or 
            you have some questions, we are here to support you.
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
          As a reminder, you can always manage your schedule, update your availability, 
          and review helpful resources over at the{" "}
          <Link
            href={portalUrl}
            style={{
              color: "#0E5B94",
              fontWeight: "bold",
              textDecoration: "underline",
            }}
          >
            Connect Me Tutor Portal
          </Link>.
        </Text>

        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          If you have any immediate questions, feel free to reply directly to this email
          or reach out to our team on Discord.
        </Text>

        <Section style={{ paddingTop: "16px" }}>
          <Text style={{ color: "#30302F", fontSize: "16px", lineHeight: "1.6", margin: "0" }}>
            Best,
          </Text>
          <Text style={{ color: "#040405", fontSize: "16px", lineHeight: "1.6", fontWeight: "bold", margin: "0" }}>
            Connect Me Free Tutoring & Mentoring
          </Text>
        </Section>
      </Section>
    </Container>
  );

  if (isPreview) {
    return (
      <div style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}>
        <EmailContent />
      </div>
    );
  }

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}>
        <EmailContent />
      </Body>
    </Html>
  );
}