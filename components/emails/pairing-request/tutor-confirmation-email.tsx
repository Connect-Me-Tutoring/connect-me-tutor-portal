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

const STARTER_PACK_URL =
  "https://docs.google.com/document/d/1eVQPX2Rjx-b5n93070zHjXSMpzBs0twwGpRPAOYmHec/edit?tab=t.0#heading=h.kk1966kbedef";
const PORTAL_URL = "https://www.connectmego.app/";

export default function TutorPairingConfirmationEmail({
  tutor,
  student,
  availability,
  startDate,
  meeting,
  isPreview = false,
}: PairingConfirmationEmailProps) {
  // Extract data from student object with fallbacks
  const subjects = student.subjects_of_interest || ["TBD"];
  const languages = student.languages_spoken || [""];
  const studentName = `${student.firstName} ${student.lastName}`;
  const firstSession = formatDateWithOptions(startDate, { month: true, day: true });
  const start = to12HourWithMinutes(availability.startTime);
  const end = to12HourWithMinutes(availability.endTime);

  return (
    <EmailLayout
      preview={`You've been matched with ${studentName}. Sessions start ${firstSession}.`}
      isPreview={isPreview}
      footerTagline="Connect Me Online Tutoring | Connecting Students with Success"
    >
      <EmailBadge tone="success">Matched</EmailBadge>
      <EmailHeading description={`Sessions start ${firstSession}.`}>
        You&apos;ve been matched with {student.firstName}!
      </EmailHeading>

      <EmailText>
        Dear {tutor.firstName} {tutor.lastName},
      </EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        Congratulations! You have been matched with a new student: <strong>{studentName}</strong>.
        Your sessions will occur on <strong>{availability.day}</strong> from{" "}
        <strong>{start} EST</strong> to <strong>{end} EST</strong> starting on{" "}
        <strong>{firstSession}</strong>. Please reach out to the student or their parent to
        introduce yourself and coordinate your tutoring schedule.
      </EmailText>

      <EmailDetails
        title="Your Student"
        rows={[
          { label: "Name", value: studentName },
          {
            label: "Email",
            value: <EmailLink href={`mailto:${student.email}`}>{student.email}</EmailLink>,
          },
          ...(student.parentName ? [{ label: "Parent/Guardian", value: student.parentName }] : []),
          ...(student.parentEmail
            ? [
                {
                  label: "Parent Email",
                  value: (
                    <EmailLink href={`mailto:${student.parentEmail}`}>
                      {student.parentEmail}
                    </EmailLink>
                  ),
                },
              ]
            : []),
          ...(student.parentPhone ? [{ label: "Parent Phone", value: student.parentPhone }] : []),
          { label: "Subjects of Interest", value: subjects.join(", ") },
          ...(languages.filter(Boolean).length
            ? [{ label: "Languages Spoken", value: languages.join(", ") }]
            : []),
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
        items={[
          `Contact ${student.parentName ? student.parentName : `${student.firstName}'s parent`} to introduce yourself and coordinate your tutoring schedule`,
          "Review the Connect Me Tutor Starter Pack before your first session",
          "Fill out the session exit form after each tutoring session through the tutor portal",
        ]}
      />

      <EmailDetails
        title="Important Resources"
        rows={[
          {
            label: "Tutor Starter Pack",
            value: (
              <EmailLink href={STARTER_PACK_URL}>Please read before your first session</EmailLink>
            ),
          },
          {
            label: "Tutor Portal",
            value: (
              <EmailLink href={PORTAL_URL}>Access zoom link and complete session forms</EmailLink>
            ),
          },
        ]}
      />

      <EmailCallout
        tone="warning"
        title="Action Required"
        paragraphs={[
          "Please reply to this email to confirm that you have received this pairing notification and understand your responsibilities as outlined above.",
          <>
            If you have any concerns about tutoring this student or need assistance, please contact{" "}
            <strong>Yulianna, Addison, or Claudia</strong>.
          </>,
        ]}
      />

      <EmailSignature />
    </EmailLayout>
  );
}
