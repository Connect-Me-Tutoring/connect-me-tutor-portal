import React from "react";
import { formatDateWithOptions, to12HourWithMinutes } from "@/lib/utils";
import { PairingConfirmationEmailProps } from "@/types/email";
import {
  EmailBadge,
  EmailButton,
  EmailCallout,
  EmailDetails,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailList,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

export default function StudentPairingConfirmationEmail({
  student,
  tutor,
  startDate,
  availability,
  meeting,
  isPreview = false,
}: PairingConfirmationEmailProps) {
  const studentName = `${student.firstName} ${student.lastName}`;
  const firstSession = formatDateWithOptions(startDate, { month: true, day: true });
  const start = to12HourWithMinutes(availability.startTime);
  const end = to12HourWithMinutes(availability.endTime);

  return (
    <EmailLayout
      preview={`${studentName} has been matched with a tutor! First session ${firstSession}.`}
      isPreview={isPreview}
    >
      <EmailBadge tone="success">Matched</EmailBadge>
      <EmailHeading description={`Sessions start ${firstSession}.`}>
        {student.firstName} has been matched with a tutor!
      </EmailHeading>

      <EmailText>Dear {student.parentName || `${studentName}'s parent`},</EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        We are excited to let you know that {studentName} has been matched with a tutor! Your
        sessions will occur on <strong>{availability.day}</strong> from <strong>{start} EST</strong>{" "}
        to <strong>{end} EST</strong> on <strong>{firstSession}</strong>. If unable to attend these
        sessions, please reach out to {tutor.email} to arrange a different time.
      </EmailText>

      <EmailDetails
        title="Your Tutor"
        rows={[
          { label: "Name", value: `${tutor.firstName} ${tutor.lastName}` },
          {
            label: "Email",
            value: <EmailLink href={`mailto:${tutor.email}`}>{tutor.email}</EmailLink>,
          },
          { label: "Schedule", value: `${availability.day}s, ${start} – ${end} EST` },
        ]}
      />

      <EmailText small style={{ marginBottom: "12px" }}>
        <strong>Join Your Tutoring Session.</strong> Click the button below to join your scheduled
        tutoring sessions:
      </EmailText>
      <EmailButton href={meeting.link}>Join Meeting</EmailButton>
      <EmailText muted small style={{ marginTop: "-12px", wordBreak: "break-all" }}>
        Or copy this link: <EmailLink href={meeting.link}>{meeting.link}</EmailLink>
      </EmailText>

      <EmailList
        title="Next Steps"
        ordered={false}
        items={[
          "In the meantime, we recommend that you create an account on the Connect Me Tutor Portal so you can easily access the zoom link and communicate with the tutor through the website.",
          "Please check your inbox and spam for an email from Connect Me to sign up for our tutor portal.",
        ]}
      />

      <EmailCallout tone="neutral" title="Need Help?">
        If you experience any issues, please reach out to{" "}
        <EmailLink href="mailto:ykowalczyk@connectmego.org">ykowalczyk@connectmego.org</EmailLink>{" "}
        for assistance.
      </EmailCallout>

      <EmailSignature closing="Best," />
    </EmailLayout>
  );
}
