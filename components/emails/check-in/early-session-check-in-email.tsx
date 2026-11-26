import React from "react";
import { EarlySessionCheckInEmailProps } from "@/types/email";
import {
  EmailBadge,
  EmailButton,
  EmailCallout,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

const DEFAULT_PORTAL = "https://www.connectmego.app/";
const DEFAULT_GUIDEBOOK = "https://drive.google.com/file/d/1vk9neT5FzDfk2ICpW6aeP5B_OL06te8i/view";

export default function EarlySessionCheckInEmail({
  recipientRole,
  tutor,
  student,
  portalUrl = DEFAULT_PORTAL,
  guidebookUrl = DEFAULT_GUIDEBOOK,
  isPreview = false,
}: EarlySessionCheckInEmailProps) {
  const tutorFullName = `${tutor.firstName} ${tutor.lastName}`.trim();
  const studentFullName = `${student.firstName} ${student.lastName}`.trim();

  const parentGreeting = student.parentName || `${student.firstName} ${student.lastName}'s parent`;

  const greeting = recipientRole === "tutor" ? `Dear ${tutorFullName},` : `Dear ${parentGreeting},`;

  const previewText =
    recipientRole === "tutor"
      ? `Quick check-in after your first sessions with ${student.firstName}`
      : `Quick check-in on ${student.firstName}'s first tutoring sessions`;

  const heading =
    recipientRole === "tutor"
      ? `How are sessions with ${student.firstName} going?`
      : `How is tutoring going for ${student.firstName}?`;

  return (
    <EmailLayout preview={previewText} isPreview={isPreview}>
      <EmailBadge>Check-in</EmailBadge>
      <EmailHeading>{heading}</EmailHeading>

      <EmailText>{greeting}</EmailText>

      {recipientRole === "tutor" ? (
        <>
          <EmailCallout>
            Now that you have had your first session or two with <strong>{studentFullName}</strong>,
            we wanted to check in. How are things going? If anything feels unclear or you need
            support, we are here for you.
          </EmailCallout>
          <EmailText>
            Please remember to visit the{" "}
            <EmailLink href={portalUrl}>Connect Me Tutor Portal</EmailLink> and submit a Session
            Exit Form (SEF) after each session so we can stay up to date on progress.
          </EmailText>
          <EmailButton href={portalUrl}>Open the Tutor Portal</EmailButton>
          <EmailText>
            You can cancel, reschedule, or add sessions through the portal. For more detail, see the{" "}
            <EmailLink href={guidebookUrl}>Connect Me Guidebook</EmailLink>.
          </EmailText>
        </>
      ) : (
        <>
          <EmailCallout>
            Now that <strong>{student.firstName}</strong> has had their first session or two with{" "}
            <strong>{tutorFullName}</strong>, we wanted to check in. We hope tutoring is off to a
            good start. If you have questions about scheduling or how sessions work, you can reach
            out to your tutor or to us any time.
          </EmailCallout>
          <EmailText>
            If you need to adjust meeting times or have questions about your student&apos;s
            sessions, you can coordinate with <strong>{tutor.firstName}</strong> at{" "}
            <EmailLink href={`mailto:${tutor.email}`}>{tutor.email}</EmailLink>. You can also use
            the <EmailLink href={portalUrl}>Connect Me portal</EmailLink> for scheduling and updates
            when available to your account.
          </EmailText>
          <EmailText>
            For general questions about the program, please email{" "}
            <EmailLink href="mailto:operations@connectmego.org">
              operations@connectmego.org
            </EmailLink>{" "}
            with the subject line &quot;Connect Me Question&quot;.
          </EmailText>
        </>
      )}

      <EmailText style={{ margin: 0 }}>
        {recipientRole === "tutor"
          ? 'If you have any questions, feel free to reach out to us on Discord or contact operations@connectmego.org with the subject line "Connect Me Tutor Question".'
          : "Thank you for being part of the Connect Me community."}
      </EmailText>

      <EmailSignature closing="Best," />
    </EmailLayout>
  );
}
