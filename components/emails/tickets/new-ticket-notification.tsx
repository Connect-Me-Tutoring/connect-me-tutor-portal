import React from "react";
import {
  EmailBadge,
  EmailDetails,
  EmailHeading,
  EmailLayout,
  EmailLink,
  EmailPanel,
  EmailText,
} from "@/components/emails/layout/components";

export interface NewTicketNotificationEmailProps {
  ticketId: string;
  submitterName: string;
  submitterRole: string;
  contactEmail: string;
  category: string;
  urgency: string;
  subject: string;
  description: string;
  pageUrl?: string;
}

export default function NewTicketNotificationEmail({
  ticketId,
  submitterName,
  submitterRole,
  contactEmail,
  category,
  urgency,
  subject,
  description,
  pageUrl,
}: NewTicketNotificationEmailProps) {
  const fields: [string, React.ReactNode | undefined][] = [
    ["Submitted by", `${submitterName} (${submitterRole})`],
    ["Contact email", contactEmail],
    ["Category", category],
    ["Urgency", urgency],
    ["Page", pageUrl ? <EmailLink href={pageUrl}>{pageUrl}</EmailLink> : undefined],
    ["Ticket ID", ticketId],
  ];

  return (
    <EmailLayout preview={`Ticket received: ${subject}`}>
      <EmailBadge>Ticket received</EmailBadge>
      <EmailHeading>{subject}</EmailHeading>

      <EmailText style={{ marginBottom: "24px" }}>
        Thanks for reaching out. The Connect Me operations team has your ticket and will follow up
        by email.
      </EmailText>

      <EmailDetails
        title="Ticket details"
        rows={fields.filter(([, value]) => value).map(([label, value]) => ({ label, value }))}
      />

      <EmailPanel title="Description">
        <EmailText small style={{ margin: 0, whiteSpace: "pre-wrap" }}>
          {description}
        </EmailText>
      </EmailPanel>
    </EmailLayout>
  );
}
