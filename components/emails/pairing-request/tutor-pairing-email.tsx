import React from "react";
import {
  EmailBadge,
  EmailCallout,
  EmailDetails,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailPanel,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

interface TutorPairingEmailProps {
  tutorName?: string;
  studentName?: string;
  parentName?: string;
  parentTitle?: "Mr." | "Mrs." | "Ms." | "Dr.";
  sessionDay?: string;
  sessionDate?: string;
  sessionTime?: string;
  zoomLink?: string;
  subjects?: string[];
}

const STARTER_PACK_URL =
  "https://docs.google.com/document/d/1eVQPX2Rjx-b5n93070zHjXSMpzBs0twwGpRPAOYmHec/edit?tab=t.0#heading=h.kk1966kbedef";
const PORTAL_URL = "https://www.connectmego.app/";

export default function TutorPairingEmail({
  tutorName = "Emily Rodriguez",
  studentName = "Sarah Johnson",
  parentName = "Jennifer Johnson",
  parentTitle = "Mrs.",
  sessionDay = "Monday",
  sessionDate = "April 8th",
  sessionTime = "6 PM - 7 PM EST",
  zoomLink = "https://zoom.us/j/1234567890",
  subjects = ["Math", "Science"],
}: TutorPairingEmailProps) {
  const templateText = { margin: "0 0 12px", fontSize: "14px", lineHeight: "22px" };

  return (
    <EmailLayout preview={`You've been paired with ${studentName} - Action Required`}>
      <EmailBadge tone="success">Paired</EmailBadge>
      <EmailHeading>You&apos;ve been paired with {studentName}</EmailHeading>

      <EmailText>Hi {tutorName},</EmailText>

      <EmailCallout title="First session">
        Your first session with {studentName} will start on {sessionDay}, {sessionDate} from{" "}
        {sessionTime}.
      </EmailCallout>

      <EmailText style={{ marginBottom: "24px" }}>
        <strong>
          Please send a tutor introduction to your student&apos;s parents 3-4 days before the
          session.
        </strong>{" "}
        This will let you introduce yourself and have a chance to ask them to send you any homework
        that the student has beforehand. Make sure to remind them the day of the session as well!
      </EmailText>

      <EmailPanel title="Introduction Template">
        <EmailText style={templateText}>
          Hello {parentTitle} {parentName}, my name is {tutorName}, and I&apos;m your tutor for{" "}
          {studentName}, paired to you through Connect Me tutoring.
        </EmailText>
        <EmailText style={templateText}>
          {studentName} will be meeting with me every {sessionDay} from {sessionTime}. I&apos;ll
          send the Zoom link below as well, which will stay the same every week.
        </EmailText>
        <EmailText style={templateText}>
          <strong>Zoom Link:</strong> <EmailLink href={zoomLink}>{zoomLink}</EmailLink>
        </EmailText>
        <EmailText style={templateText}>
          Please be aware that if {studentName} is unable to attend two consecutive sessions without
          prior notification, their tutoring privileges may be reconsidered.
        </EmailText>
        <EmailText style={{ ...templateText, margin: 0 }}>
          It&apos;s nice meeting you, and if you have any questions, please don&apos;t hesitate to
          ask!
        </EmailText>
      </EmailPanel>

      <EmailDetails
        title="Session Details"
        rows={[
          { label: "Student", value: studentName },
          { label: "Parent", value: `${parentTitle} ${parentName}` },
          { label: "Subjects", value: subjects.join(", ") },
          { label: "Schedule", value: `${sessionDay}s from ${sessionTime}` },
          { label: "Zoom Link", value: <EmailLink href={zoomLink}>{zoomLink}</EmailLink> },
        ]}
      />

      <EmailDetails
        title="Important Resources"
        rows={[
          {
            label: "Connect Me Tutor Starter Pack",
            value: (
              <EmailLink href={STARTER_PACK_URL}>Please read before your first session</EmailLink>
            ),
          },
          {
            label: "Tutor Portal",
            value: (
              <EmailLink href={PORTAL_URL}>
                Access zoom link and fill out exit form after EVERY session
              </EmailLink>
            ),
          },
        ]}
      />

      <EmailText>
        If you have any concerns about tutoring your student—such as being unable to continue
        sessions, student is inconsistent, or feeling unsafe—please reach out to{" "}
        <strong>Yulianna, Ashritaa, or Claudia</strong>.
      </EmailText>

      <EmailCallout tone="danger" title="Action Required">
        Please respond to this message acknowledging you&apos;ve read it and understand that you
        have been paired with this student.
      </EmailCallout>

      <EmailSignature closing="Best," />
    </EmailLayout>
  );
}
