import { Profile } from "@/types";
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

interface TutorProbationEmailProps {
  tutor: Profile;
  reason: string;
  monitoringWindowDays?: number;
  replyWithinHours?: number;
  isPreview?: boolean;
}

export default function TutorProbationEmail({
  tutor,
  reason,
  monitoringWindowDays = 28,
  replyWithinHours = 72,
  isPreview = false,
}: TutorProbationEmailProps) {
  return (
    <EmailLayout
      preview={`Your Connect Me membership is on probation. Reply within ${replyWithinHours} hours.`}
      isPreview={isPreview}
      footerTagline="Connect Me Online Tutoring | Connecting Students with Success"
    >
      <EmailBadge tone="danger">Membership status: Probation</EmailBadge>
      <EmailHeading description={`Reply within ${replyWithinHours} hours to stay a member.`}>
        Your membership is on probation
      </EmailHeading>

      <EmailText>
        Dear {tutor.firstName} {tutor.lastName},
      </EmailText>
      <EmailText>
        This email serves as formal notification that your membership with Connect Me Tutoring has
        been placed on probationary status.
      </EmailText>

      <EmailCallout tone="neutral" title="Why">
        At Connect Me, we maintain high professional standards for our volunteers, and your recent
        activity has not met these requirements. Specifically, you have <strong>{reason}</strong>.
        As a result, your continued involvement with the organization is now under formal review.
      </EmailCallout>

      <EmailList
        title="Required obligations to return to good standing"
        description={
          <>
            Fulfill these within the monitoring window of{" "}
            <strong>{monitoringWindowDays} days</strong>, effective immediately upon this email:
          </>
        }
        items={[
          "Attend all mandatory bi-weekly meetings.",
          "Respond to Discord messages from leadership members within 12 hours.",
          "Submit all Session Exit Forms (SEFs) through the Tutor Portal after every session.",
          "Maintain professional and timely communication with your students and their parents.",
        ]}
      />

      <EmailText>
        Please understand that this period is your final opportunity to demonstrate the commitment
        and professionalism required of our members. Failure to comply with these guidelines, or any
        further violations of organization policy, will result in the immediate termination of your
        membership.
      </EmailText>

      <EmailCallout
        tone="danger"
        title={`Action required: reply within ${replyWithinHours} hours`}
        paragraphs={[
          <>
            You must <strong>&quot;reply all&quot;</strong> directly to this email within{" "}
            <strong>{replyWithinHours} hours</strong> to confirm your continued participation in
            Connect Me. Failure to respond within this timeframe will result in the termination of
            your membership.
          </>,
          <>
            If you have any questions regarding your probationary status, please{" "}
            <strong>&quot;reply all&quot;</strong> to this thread.
          </>,
        ]}
      />

      <EmailSignature />
    </EmailLayout>
  );
}
