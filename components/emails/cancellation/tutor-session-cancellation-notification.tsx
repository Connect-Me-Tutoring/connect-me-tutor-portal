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

export interface TutorSessionCancellationEmailProps {
  tutorName: string;
  studentName: string;
  sessionDate: string;
  sessionTime: string;
  reason?: string;
  portalUrl?: string;
}

export const TutorSessionCancellationNotificationEmail = ({
  tutorName = "Tutor",
  studentName = "Your Student",
  sessionDate,
  sessionTime,
  reason,
  portalUrl,
}: TutorSessionCancellationEmailProps) => {
  return (
    <EmailLayout preview="A tutoring session has been cancelled">
      <EmailBadge tone="danger">Cancelled</EmailBadge>
      <EmailHeading>Tutor Session Cancelled</EmailHeading>

      <EmailText>Hi {tutorName},</EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        This is a notification that your upcoming session with {studentName} has been cancelled.
      </EmailText>

      <EmailDetails
        rows={[
          { label: "Date", value: sessionDate },
          { label: "Time", value: sessionTime },
          ...(reason ? [{ label: "Reason", value: reason }] : []),
        ]}
      />

      <EmailText style={{ margin: 0 }}>
        If you would like to reschedule, please coordinate with your student
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

export default TutorSessionCancellationNotificationEmail;

TutorSessionCancellationNotificationEmail.PreviewProps = {
  tutorName: "Bob",
  studentName: "Alice",
  sessionDate: "May 20, 2026",
  sessionTime: "3:00 PM",
  reason: "Student unavailable",
  portalUrl: "https://portal.connectmego.app",
};
