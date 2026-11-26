import React from "react";
import {
  EmailButton,
  EmailHeading,
  EmailLayout,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

interface FeedbackEmailProps {
  studentName?: string;
}

const FEEDBACK_FORM_URL =
  "https://docs.google.com/forms/d/1YPS8angPHS1HEyDn6ub2d5iEsfjuvi0N_Yr7YevaSIc/viewform?edit_requested=true#responses";

export default function FeedbackEmail({ studentName = "Student" }: FeedbackEmailProps) {
  return (
    <EmailLayout preview="Please provide feedback for your recent session">
      <EmailHeading description="It only takes a minute.">How was your session?</EmailHeading>

      <EmailText>Hi {studentName},</EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        Your tutor has just completed the Session Exit Form for your recent session. We would love
        to hear your thoughts! Please take a moment to fill out our feedback form by clicking the
        button below:
      </EmailText>

      <EmailButton href={FEEDBACK_FORM_URL}>Provide Feedback</EmailButton>

      <EmailSignature closing="Best," />
    </EmailLayout>
  );
}
