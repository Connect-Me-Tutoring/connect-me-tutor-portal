import React from "react";
import { ParentMonthlyCheckInEmailProps } from "@/types/email";
import {
  EmailBadge,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailList,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

export default function ParentMonthlyCheckInEmail({
  parentName,
  student,
  tutor,
  monthsSinceStart,
}: ParentMonthlyCheckInEmailProps) {
  const months = `${monthsSinceStart} month${monthsSinceStart !== 1 ? "s" : ""}`;

  return (
    <EmailLayout preview={`How is tutoring going for ${student.firstName}? Monthly check-in`}>
      <EmailBadge>Monthly check-in</EmailBadge>
      <EmailHeading>How is tutoring going for {student.firstName}?</EmailHeading>

      <EmailText>Hi {parentName},</EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        It&apos;s been {months} since {student.firstName} started tutoring sessions with{" "}
        {tutor.firstName} {tutor.lastName}. We hope everything has been going smoothly!
      </EmailText>

      <EmailList
        title="Monthly Check-In Questions:"
        ordered={false}
        items={[
          <>How has {student.firstName}&apos;s experience been with the tutoring sessions?</>,
          <>
            Is {student.firstName} enjoying working with {tutor.firstName}?
          </>,
          <>
            Have you noticed any improvements in {student.firstName}&apos;s academic performance or
            confidence?
          </>,
          "Are there any concerns or suggestions you'd like to share?",
        ]}
      />

      <EmailText>
        Your feedback is invaluable in helping us provide the best possible tutoring experience for
        your child. Please don&apos;t hesitate to contact us with any thoughts or concerns you may
        have.
      </EmailText>
      <EmailText style={{ margin: 0 }}>
        Thank you for being part of the Connect Me community and supporting your child&apos;s
        education!
      </EmailText>

      <EmailSignature name="The Connect Me Team">
        <EmailLink href="mailto:support@connectme.org">support@connectme.org</EmailLink>
      </EmailSignature>
    </EmailLayout>
  );
}
