import React from "react";
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

export interface MonthlyCheckInEmailProps {
  firstName: string;
  role: "tutor" | "student" | "parent";
  portalUrl?: string;
  isPreview?: boolean;
}

const DEFAULT_PORTAL = "https://www.connectmego.app/";

export default function MonthlyCheckInEmail({
  firstName = "User",
  portalUrl = DEFAULT_PORTAL,
  isPreview = false,
}: MonthlyCheckInEmailProps) {
  return (
    <EmailLayout preview="Your Monthly Connect Me Check-In!" isPreview={isPreview}>
      <EmailBadge>Monthly check-in</EmailBadge>
      <EmailHeading>Connect Me Monthly Check-In</EmailHeading>

      <EmailText>Dear {firstName},</EmailText>

      <EmailCallout>
        Another month has flown by! We just wanted to check in to see how your tutoring sessions are
        going. Whether everything is running smoothly or you have some questions, we are here to
        support you.
      </EmailCallout>

      <EmailText>
        As a reminder, you can always manage your schedule, update your availability, and review
        helpful resources over at the{" "}
        <EmailLink href={portalUrl}>Connect Me Tutor Portal</EmailLink>.
      </EmailText>
      <EmailButton href={portalUrl}>Open the Tutor Portal</EmailButton>

      <EmailText style={{ margin: 0 }}>
        If you have any immediate questions, feel free to reply directly to this email or reach out
        to our team on Discord.
      </EmailText>

      <EmailSignature closing="Best," />
    </EmailLayout>
  );
}
