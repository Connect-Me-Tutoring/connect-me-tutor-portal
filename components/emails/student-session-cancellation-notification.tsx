import {
  Body,
  Container,
  Head,
  Heading,
  Html,
  Preview,
  Section,
  Text,
  Link,
} from "@react-email/components";
import * as React from "react";

export interface StudentSessionCancellationEmailProps {
  studentName: string;
  tutorName: string;
  sessionDate: string;
  sessionTime: string;
  reason?: string;
  portalUrl?: string;
}

export const SessionCancellationNotificationEmail = ({
  studentName = "Student",
  tutorName = "Your Tutor",
  sessionDate,
  sessionTime,
  reason,
  portalUrl,
}: StudentSessionCancellationEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your tutoring session has been cancelled</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>Tutor Session Cancelled</Heading>
            <Text style={text}>Hi {studentName},</Text>
            <Text style={text}>
              This is a notification that your upcoming session with {tutorName} has been cancelled.
            </Text>
            <Text style={text}>
              <strong>Date:</strong> {sessionDate}
              <br />
              <strong>Time:</strong> {sessionTime}
            </Text>
            {reason && (
              <Text style={text}>
                <strong>Reason:</strong> {reason}
              </Text>
            )}
            <Text style={text}>
              If you would like to reschedule, please reach out to your tutor
              {portalUrl ? (
                <>
                  {" "}
                  or manage your sessions through the{" "}
                  <Link href={portalUrl}>Connect Me portal</Link>
                </>
              ) : null}
              .
            </Text>
            <Text style={text}>
              Best,
              <br />
              <br />
              The Connect Me Free Tutoring & Mentoring Team
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
};

const main = {
  backgroundColor: "#f6f9fc",
  fontFamily:
    '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
};

const container = {
  backgroundColor: "#ffffff",
  margin: "0 auto",
  padding: "20px 0 48px",
  marginBottom: "64px",
};

const section = {
  padding: "0 48px",
};

const h1 = {
  color: "#333",
  fontSize: "24px",
  fontWeight: "bold",
  margin: "40px 0",
  padding: "0",
};

const text = {
  color: "#333",
  fontSize: "16px",
  lineHeight: "24px",
  margin: "16px 0",
};

export default SessionCancellationNotificationEmail;

SessionCancellationNotificationEmail.PreviewProps = {
  studentName: "Alice",
  tutorName: "Bob",
  sessionDate: "May 20, 2026",
  sessionTime: "3:00 PM",
  reason: "Tutor unavailable due to illness",
  portalUrl: "https://portal.connectmego.app",
};
