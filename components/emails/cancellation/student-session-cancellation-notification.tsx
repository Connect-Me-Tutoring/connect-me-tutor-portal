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
    <EmailLayout preview="Your tutoring session has been cancelled">
      <EmailBadge tone="danger">Cancelled</EmailBadge>
      <EmailHeading>Tutor Session Cancelled</EmailHeading>

      <EmailText>Hi {studentName},</EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        This is a notification that your upcoming session with {tutorName} has been cancelled.
      </EmailText>

      <EmailDetails
        rows={[
          { label: "Date", value: sessionDate },
          { label: "Time", value: sessionTime },
          ...(reason ? [{ label: "Reason", value: reason }] : []),
        ]}
      />

      <EmailText style={{ margin: 0 }}>
        If you would like to reschedule, please reach out to your tutor
        {portalUrl ? (
          <>
            {" "}
            or manage your sessions through the{" "}
            <EmailLink href={portalUrl}>Connect Me portal</EmailLink>
          </>
        ) : null}
        .
      </EmailText>

      <EmailSignature closing="Best," name="The Connect Me Free Tutoring & Mentoring Team" />
    </EmailLayout>
  );
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
