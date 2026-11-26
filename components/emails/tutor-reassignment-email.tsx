import React from "react";
import {
  EmailBadge,
  EmailCallout,
  EmailDetails,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailSignature,
  EmailText,
} from "@/components/emails/layout/components";

interface TutorReassignmentEmailProps {
  studentName?: string;
  parentName?: string;
  gender?: "male" | "female" | "other";
  subjects?: string[];
  sessionDay?: string;
  sessionTime?: string;
  firstSessionDate?: string;
  zoomLink?: string;
  tutorName?: string;
  tutorEmail?: string;
}

export default function TutorReassignmentEmail({
  studentName = "Sarah Johnson",
  parentName = "Jennifer Johnson",
  gender = "female",
  subjects = [
    "Math",
    "Science",
    "Social Studies",
    "English/Reading/Writing",
    "Time Management/Organization",
    "Navigating Online Learning Platforms",
  ],
  sessionDay = "Saturdays",
  sessionTime = "12-1 pm EST",
  firstSessionDate = "Saturday, April 4th",
  zoomLink = "https://zoom.us/j/1234567890",
  tutorName = "Ms. Emily Rodriguez",
  tutorEmail = "emily.rodriguez@connectme.com",
}: TutorReassignmentEmailProps) {
  // Get pronouns based on gender
  const getPronoun = (type: "subject" | "object" | "possessive") => {
    switch (gender) {
      case "male":
        return type === "subject" ? "he" : type === "object" ? "him" : "his";
      case "female":
        return type === "subject" ? "she" : type === "object" ? "her" : "her";
      default:
        return type === "subject" ? "they" : type === "object" ? "them" : "their";
    }
  };

  const objectPronoun = getPronoun("object");
  const possessivePronoun = getPronoun("possessive");

  return (
    <EmailLayout preview={`${studentName}'s New Tutoring Sessions [PLEASE REPLY]`}>
      <EmailBadge>New tutor</EmailBadge>
      <EmailHeading>{studentName}&apos;s New Tutoring Sessions</EmailHeading>

      <EmailText>Hi {parentName},</EmailText>
      <EmailText>
        Thanks for continuing your support of {studentName}&apos;s learning through Connect Me
        Tutoring! We have matched {objectPronoun} with a new tutor for the subjects requested:{" "}
        <strong>{subjects.join(", ")}</strong>, for one session per week. We&apos;ve rescheduled{" "}
        {objectPronoun} for{" "}
        <strong>
          {sessionDay} from {sessionTime}
        </strong>
        . We have included a new Zoom link below, which will be reusable each week.
      </EmailText>

      <EmailCallout title="First session">
        {studentName}&apos;s first session with {possessivePronoun} new tutor will be on{" "}
        {firstSessionDate} from {sessionTime}.
      </EmailCallout>

      <EmailText>
        Be sure to set an alarm on your phone so you don&apos;t accidentally miss your first
        tutoring class.
      </EmailText>
      <EmailText>
        <strong>
          Please reply and confirm with us whether these revised dates/times work for your family.
        </strong>{" "}
        The new tutor should contact you a couple of days before the session, and I have included
        their contact information below.
      </EmailText>
      <EmailText style={{ marginBottom: "24px" }}>
        We&apos;re grateful to have {studentName} continue learning with us and remain a part of the
        Connect Me community!
      </EmailText>

      <EmailDetails
        title="New Session Details"
        rows={[
          { label: "Zoom Link", value: <EmailLink href={zoomLink}>{zoomLink}</EmailLink> },
          { label: "Tutor's Name", value: tutorName },
          {
            label: "Email",
            value: <EmailLink href={`mailto:${tutorEmail}`}>{tutorEmail}</EmailLink>,
          },
        ]}
      />

      <EmailSignature closing="Best," />
    </EmailLayout>
  );
}
