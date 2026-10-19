import { Html, Head, Body, Container, Text, Link, Section } from "@react-email/components";

export interface ParentalConsentRequestEmailProps {
  parentName: string;
  studentFirstName: string;
  consentUrl: string;
  privacyUrl: string;
  expiresInDays: number;
}

export default function ParentalConsentRequestEmail({
  parentName,
  studentFirstName,
  consentUrl,
  privacyUrl,
  expiresInDays,
}: ParentalConsentRequestEmailProps) {
  const textStyle = { color: "#040405", fontSize: "16px", lineHeight: "1.6", margin: "0 0 16px 0" };

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}>
        <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
          <Section
            style={{
              backgroundColor: "#0E5B94",
              color: "#ffffff",
              padding: "24px",
              textAlign: "center",
            }}
          >
            <Text style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
              Connect Me Free Tutoring & Mentoring
            </Text>
          </Section>

          <Section style={{ padding: "24px" }}>
            <Text style={textStyle}>Hi {parentName || "there"},</Text>
            <Text style={textStyle}>
              {studentFirstName} has been signed up for free tutoring with Connect Me. Because{" "}
              {studentFirstName} is under 13, we need your permission before we create an account or
              collect any information from them.
            </Text>
            <Text style={textStyle}>
              Please review what we collect and how we use it, then approve or decline. Nothing is
              set up until you approve.
            </Text>
            <Text style={{ margin: "24px 0", textAlign: "center" }}>
              <Link
                href={consentUrl}
                style={{
                  backgroundColor: "#0E5B94",
                  color: "#ffffff",
                  padding: "12px 24px",
                  borderRadius: "6px",
                  textDecoration: "none",
                  fontWeight: "bold",
                }}
              >
                Review and respond
              </Link>
            </Text>
            <Text style={{ ...textStyle, fontSize: "14px" }}>
              This link expires in {expiresInDays} days. Read our{" "}
              <Link href={privacyUrl}>Privacy Policy</Link>. If you weren&apos;t expecting this
              email, you can ignore it and no account will be created.
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}
