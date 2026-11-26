import React from "react";
import {
  EmailBadge,
  EmailCallout,
  EmailHeading,
  EmailLayout,
  EmailList,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

export const STUDENT_WAITLIST_STATUS_SUBJECT = "Connect Me Tutoring Status";

export interface StudentWaitlistStatusEmailProps {
  parentName?: string | null;
  studentName: string;
  replyWithinHours?: number;
  isPreview?: boolean;
  /** Absolute URL of the logo; email clients cannot load relative paths. */
  logoUrl?: string;
}

const commitments = [
  "Your student will attend every scheduled session.",
  "You will monitor your email and reply to our messages within 24 hours.",
  "You will complete onboarding promptly once you are paired.",
  "You will keep in consistent contact with your student's tutor. If communication breaks down because of repeated unresponsiveness from the parent, your student may no longer be eligible for tutoring through Connect Me.",
];

/**
 * Sent to a newly added student's parent when no tutor has been found yet: places
 * the student on the waiting list and asks the parent to confirm their commitment.
 */
export default function StudentWaitlistStatusEmail({
  parentName,
  studentName,
  replyWithinHours = 48,
  isPreview = false,
  logoUrl,
}: StudentWaitlistStatusEmailProps) {
  const greetingName = parentName?.trim() || `${studentName}'s parent`;
  const studentFirstName = studentName.trim().split(/\s+/)[0] || studentName;

  return (
    <EmailLayout
      preview={`${studentFirstName} is on the Connect Me waiting list. Please reply within ${replyWithinHours} hours.`}
      isPreview={isPreview}
      logoUrl={logoUrl}
      footerTagline="Connect Me Online Tutoring · Connecting Students with Success"
    >
      <EmailBadge>On the waiting list</EmailBadge>
      <EmailHeading description="We'll let you know as soon as a tutor is available.">
        {studentFirstName} is on our waiting list
      </EmailHeading>

      <EmailText>Hello {greetingName},</EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        Thank you for applying for Connect Me Tutoring for <strong>{studentName}</strong>! We are
        experiencing very high demand, and we want every tutor matched with a student who is ready
        to make the most of it. We don&apos;t have a tutor available right away, so we have added
        your student to our waiting list.
      </EmailText>

      <EmailList
        title="Before you're matched"
        description="If you can commit for at least the next 6 to 12 months, please confirm that:"
        items={commitments}
      />

      <EmailCallout title={`Action needed: reply within ${replyWithinHours} hours`}>
        Reply to this email if you are still looking for tutoring for your student, and we will
        notify you as soon as a tutor becomes available. If we don&apos;t hear back within{" "}
        {replyWithinHours} hours, we may ask you to reapply.
      </EmailCallout>

      <EmailText>
        If your plans have changed, no problem. Just <strong>reply all</strong> to this email and we
        will update our list.
      </EmailText>
      <EmailText style={{ margin: 0 }}>Thank you for your understanding and patience.</EmailText>

      <EmailSignature />
    </EmailLayout>
  );
}
