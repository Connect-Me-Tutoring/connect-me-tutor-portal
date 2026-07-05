import React from "react";
import {
  Body,
  Container,
  Head,
  Html,
  Preview,
  Section,
  Text,
  Button,
} from "@react-email/components";

interface FeedbackEmailProps {
  studentName?: string;
}

export default function FeedbackEmail({ studentName = "Student" }: FeedbackEmailProps) {
  return (
    <Html>
      <Head />
      <Preview>Please provide feedback for your recent session</Preview>
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
          <Section style={{ backgroundColor: "#0E5B94", color: "#ffffff", padding: "24px", textAlign: "center" }}>
            <Text style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
              Connect Me Free Tutoring & Mentoring
            </Text>
          </Section>

          <Section style={{ padding: "24px" }}>
            <Text style={{ color: "#040405", fontSize: "16px", lineHeight: "1.6", margin: "0 0 24px 0" }}>
              Hi {studentName},
            </Text>
            <Text style={{ color: "#040405", fontSize: "16px", lineHeight: "1.6", margin: "0 0 24px 0" }}>
              Your tutor has just completed the Session Exit Form for your recent session. We would love to hear your thoughts! Please take a moment to fill out our feedback form by clicking the button below:
            </Text>
            
            <Button 
              href="https://docs.google.com/forms/d/1YPS8angPHS1HEyDn6ub2d5iEsfjuvi0N_Yr7YevaSIc/viewform?edit_requested=true#responses"
              style={{ backgroundColor: "#f97316", color: "#fff", padding: "12px 20px", borderRadius: "5px", textDecoration: "none", display: "inline-block", marginTop: "8px" }}
            >
              Provide Feedback
            </Button>

            <Section style={{ paddingTop: "32px" }}>
              <Text style={{ color: "#30302F", fontSize: "16px", lineHeight: "1.6", margin: "0" }}>Best,</Text>
              <Text style={{ color: "#040405", fontSize: "16px", lineHeight: "1.6", fontWeight: "bold", margin: "0" }}>
                Connect Me Free Tutoring & Mentoring
              </Text>
            </Section>
          </Section>

          <Section style={{ backgroundColor: "#30302F", padding: "16px", textAlign: "center", borderTop: "1px solid #495860" }}>
            <Text style={{ color: "#8494A8", fontSize: "14px", margin: "0" }}>Connect Me Free Tutoring & Mentoring</Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
