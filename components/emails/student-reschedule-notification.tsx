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

export interface SessionRescheduleEmailProps {
  studentName: string;
  tutorName: string;
  newDate: string;
  newTime: string;
  meetingLink?: string;
}

export const StudentRescheduleNotificationEmail = ({
  studentName = "Student",
  tutorName = "Your Tutor",
  newDate,
  newTime,
  meetingLink,
}: SessionRescheduleEmailProps) => {
  return (
    <Html>
      <Head />
      <Preview>Your tutoring session has been rescheduled</Preview>
      <Body style={main}>
        <Container style={container}>
          <Section style={section}>
            <Heading style={h1}>Session Rescheduled</Heading>
            <Text style={text}>Hi {studentName},</Text>
            <Text style={text}>
              This is a notification that your tutor, {tutorName}, has rescheduled your upcoming session.
            </Text>
            <Text style={text}>
              <strong>New Date:</strong> {newDate}<br />
              <strong>New Time:</strong> {newTime}
            </Text>
            {meetingLink && (
              <Text style={text}>
                <strong>Meeting Link:</strong> <Link href={meetingLink}>{meetingLink}</Link>
              </Text>
            )}
            <Text style={text}>
              If you have any questions or if this time does not work for you, please reach out to your tutor.
            </Text>
            <Text style={text}>
              Best,<br />
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
  fontFamily: '-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Ubuntu,sans-serif',
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

export default StudentRescheduleNotificationEmail;