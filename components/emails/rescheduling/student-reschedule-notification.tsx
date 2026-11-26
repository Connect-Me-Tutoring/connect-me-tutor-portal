import * as React from "react";
import {
  EmailBadge,
  EmailDetails,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

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
    <EmailLayout preview="Your tutoring session has been rescheduled">
      <EmailBadge>Rescheduled</EmailBadge>
      <EmailHeading>Tutor Session Rescheduled</EmailHeading>

      <EmailText>Hi {studentName},</EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        This is a notification that your tutor, {tutorName}, has rescheduled your upcoming session.
      </EmailText>

      <EmailDetails
        title="New session time"
        rows={[
          { label: "New Date", value: newDate },
          { label: "New Time", value: newTime },
          ...(meetingLink
            ? [
                {
                  label: "Meeting Link",
                  value: <EmailLink href={meetingLink}>{meetingLink}</EmailLink>,
                },
              ]
            : []),
        ]}
      />

      <EmailText style={{ margin: 0 }}>
        If you have any questions or if this time does not work for you, please reach out to your
        tutor.
      </EmailText>

      <EmailSignature closing="Best," name="The Connect Me Free Tutoring & Mentoring Team" />
    </EmailLayout>
  );
};

export default StudentRescheduleNotificationEmail;

StudentRescheduleNotificationEmail.PreviewProps = {
  studentName: "Alice",
  tutorName: "Bob",
  newDate: "May 20, 2026",
  newTime: "3:00 PM",
  meetingLink: "https://zoom.us/test",
};
