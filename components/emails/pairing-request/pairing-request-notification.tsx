import { PairingRequestNotificationEmailProps } from "@/types/email";
import React from "react";
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

const PORTAL_URL = "https://www.connectmego.app/";

export default function PairingRequestNotificationEmail({
  tutor,
  student,
  isPreview = false,
}: PairingRequestNotificationEmailProps) {
  // Extract data from student object with fallbacks
  const subjects = student.subjects_of_interest || ["TBD"];
  const languages = student.languages_spoken || ["English"];
  const studentName = `${student.firstName} ${student.lastName}`;

  return (
    <EmailLayout
      preview={`New potential student match: ${studentName}. Please respond within 48 hours.`}
      isPreview={isPreview}
    >
      <EmailBadge>Pairing request</EmailBadge>
      <EmailHeading description="Please respond within 48 hours.">
        We found a potential student for you
      </EmailHeading>

      <EmailText>
        Dear {tutor.firstName} {tutor.lastName},
      </EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        We have found a potential tutoring match for you! Below is information about a student who
        may be a good fit based on your expertise and availability. Please review the student&apos;s
        information and let us know if you&apos;re interested in this pairing opportunity.
      </EmailText>

      <EmailDetails
        title="Potential Student Match"
        rows={[
          { label: "Name", value: studentName },
          { label: "Grade Level", value: student.grade || "Not specified" },
          ...(student.parentName ? [{ label: "Parent/Guardian", value: student.parentName }] : []),
          { label: "Preferred Contact", value: student.parentName ? "Parent/Guardian" : "Student" },
        ]}
      />

      <EmailDetails
        title="Academic Information"
        rows={[
          { label: "Subjects Needed", value: subjects.join(", ") },
          { label: "Languages Spoken", value: languages.join(", ") },
        ]}
      />

      <EmailList
        title="Interested in This Match?"
        description="If you're interested in tutoring this student:"
        items={[
          <>
            Please navigate to the tutor portal{" "}
            <EmailLink href={PORTAL_URL}>https://www.connectmego.app/</EmailLink>
          </>,
          "Locate the Pairing Dashboard under the Pairings tab",
          `Accept the pairing request for ${studentName}`,
        ]}
      />
      <EmailButton href={PORTAL_URL}>Open the Pairing Dashboard</EmailButton>

      <EmailList
        title="What Happens Next?"
        items={[
          "Visit your Pairing Dashboard and accept the pairing request if interested",
          "We'll confirm the pairing and provide student contact information",
          "You'll receive the Tutor Starter Pack and coordination instructions",
        ]}
      />

      <EmailCallout tone="warning" title="Important Note">
        This is a potential match only. No commitment has been made yet. Please respond within{" "}
        <strong>48 hours</strong> so we can proceed with pairing arrangements or find alternative
        matches for both you and the student.
      </EmailCallout>

      <EmailCallout tone="neutral" title="Questions or Concerns?">
        If you have any questions about this potential match or need assistance, please contact{" "}
        <strong>Yulianna, Addison, or Claudia</strong>.
      </EmailCallout>

      <EmailText style={{ margin: 0 }}>
        Thank you for your continued dedication to helping students succeed!
      </EmailText>

      <EmailSignature name="Connect Me Free Tutoring & Mentoring Team" />
    </EmailLayout>
  );
}
