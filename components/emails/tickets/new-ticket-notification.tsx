import React from "react";
import { Html, Head, Body, Container, Text, Section } from "@react-email/components";

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

const labelStyle = { margin: "0 0 4px", fontSize: "12px", color: "#6b7280" };
const valueStyle = { margin: "0 0 16px", fontSize: "14px", color: "#111827" };

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
  const fields: [string, string | undefined][] = [
    ["Submitted by", `${submitterName} (${submitterRole})`],
    ["Contact email", contactEmail],
    ["Category", category],
    ["Urgency", urgency],
    ["Page", pageUrl],
    ["Ticket ID", ticketId],
  ];

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "sans-serif", margin: 0, padding: 0 }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
          <Text style={{ fontSize: "20px", fontWeight: "bold", margin: "0 0 8px" }}>
            Ticket received: {subject}
          </Text>
          <Text style={{ fontSize: "14px", color: "#374151", margin: "0 0 16px" }}>
            Thanks for reaching out. The Connect Me operations team has your ticket and will follow
            up by email.
          </Text>
          <Section>
            {fields
              .filter(([, value]) => value)
              .map(([label, value]) => (
                <React.Fragment key={label}>
                  <Text style={labelStyle}>{label}</Text>
                  <Text style={valueStyle}>{value}</Text>
                </React.Fragment>
              ))}
            <Text style={labelStyle}>Description</Text>
            <Text style={{ ...valueStyle, whiteSpace: "pre-wrap" }}>{description}</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
