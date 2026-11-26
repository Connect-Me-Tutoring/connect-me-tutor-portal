import React from "react";
import { TutorMonthlyCheckInEmailProps } from "@/types/email";
import {
  EmailBadge,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailList,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

export default function TutorMonthlyCheckInEmail({
  tutor,
  student,
  monthsSinceStart,
}: TutorMonthlyCheckInEmailProps) {
  const months = `${monthsSinceStart} month${monthsSinceStart !== 1 ? "s" : ""}`;

  return (
    <EmailLayout preview={`${months} of tutoring ${student.firstName}: monthly check-in`}>
      <EmailBadge>Monthly check-in</EmailBadge>
      <EmailHeading>
        {months} with {student.firstName}
      </EmailHeading>

      <EmailText>Hi {tutor.firstName},</EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        It&apos;s been {months} since you started tutoring {student.firstName} {student.lastName}.
        We hope the sessions have been going well!
      </EmailText>

      <EmailList
        title="Monthly Check-In Questions:"
        ordered={false}
        items={[
          "How are the tutoring sessions progressing?",
          <>Is {student.firstName} making progress in the subjects you&apos;re covering?</>,
          "Are you facing any challenges?",
          "Do you need any additional resources or support?",
        ]}
      />

      <EmailText>
        Your feedback helps us ensure the best possible experience for both tutors and students.
      </EmailText>
      <EmailText style={{ margin: 0 }}>
        Thank you for your dedication to mentoring and making a difference in {student.firstName}
        &apos;s education!
      </EmailText>

      <EmailSignature name="The Connect Me Team">
        <EmailLink href="mailto:support@connectme.org">support@connectme.org</EmailLink>
      </EmailSignature>
    </EmailLayout>
  );
}
