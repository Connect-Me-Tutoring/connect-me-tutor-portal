import React from "react";
import {
  Body,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Preview,
  Row,
  Section,
  Text,
} from "@react-email/components";
import EmailFooter from "@/components/emails/email-footer";

export const STUDENT_WAITLIST_STATUS_SUBJECT = "Connect Me Tutoring Status";

export interface StudentWaitlistStatusEmailProps {
  parentName?: string | null;
  studentName: string;
  replyWithinHours?: number;
  isPreview?: boolean;
  /** Absolute URL of the logo; email clients cannot load relative paths. */
  logoUrl?: string;
}

const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || "https://www.connectmego.app").replace(
  /\/$/,
  "",
);

// Email clients ignore CSS variables and Tailwind, so the portal's tokens are inlined.
// Brand colors come from tailwind.config.ts; neutrals mirror the shadcn tokens in
// app/globals.css (background, card, border, muted-foreground).
const color = {
  blue1: "#B7E2F2",
  blue3: "#0E5B94",
  blue5: "#0B3967",
  gray2: "#495860",
  black: "#040405",
  page: "#FAFAFA", // --sidebar-background
  card: "#FFFFFF", // --card
  border: "#E5E5E5", // --border
  muted: "#737373", // --muted-foreground
  subtle: "#F5F5F5", // --muted
  tint: "#EEF7FB", // light wash of connect-me-blue-1, like the portal's active nav item
};

const font =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";

const text: React.CSSProperties = {
  color: color.black,
  fontSize: "15px",
  lineHeight: "24px",
  margin: "0 0 16px",
};

const commitments = [
  "Your student will attend every scheduled session.",
  "You will monitor your email and reply to our messages within 24 hours.",
  "You will complete onboarding promptly once you are paired.",
  "You will keep in consistent contact with your student's tutor. If communication breaks down because of repeated unresponsiveness from the parent, your student may no longer be eligible for tutoring through Connect Me.",
];

/**
 * Sent to a newly added student's parent when no tutor has been found yet: places
 * the student on the waiting list and asks the parent to confirm their commitment.
 */
export default function StudentWaitlistStatusEmail({
  parentName,
  studentName,
  replyWithinHours = 48,
  isPreview = false,
  logoUrl = `${siteUrl}/logo.png`,
}: StudentWaitlistStatusEmailProps) {
  const greetingName = parentName?.trim() || `${studentName}'s parent`;
  const studentFirstName = studentName.trim().split(/\s+/)[0] || studentName;

  const content = (
    <Container style={{ maxWidth: "560px", margin: "0 auto", padding: "32px 16px" }}>
      {/* Brand row, same as the portal sidebar */}
      <Section style={{ padding: "0 4px 20px" }}>
        <Row>
          <Column style={{ width: "36px" }}>
            <Img
              src={logoUrl}
              width="28"
              height="28"
              alt="Connect Me"
              style={{ display: "block" }}
            />
          </Column>
          <Column>
            <Text style={{ margin: 0, fontSize: "17px", fontWeight: 700, color: color.black }}>
              Connect Me
            </Text>
          </Column>
        </Row>
      </Section>

      {/* Card */}
      <Section
        style={{
          backgroundColor: color.card,
          border: `1px solid ${color.border}`,
          borderRadius: "8px",
          boxShadow: "0 1px 2px 0 rgba(0,0,0,0.05)",
        }}
      >
        <Section style={{ padding: "28px 28px 8px" }}>
          {/* Status badge */}
          <Text
            style={{
              display: "inline-block",
              margin: "0 0 16px",
              padding: "2px 10px",
              borderRadius: "9999px",
              backgroundColor: color.tint,
              border: `1px solid ${color.blue1}`,
              color: color.blue3,
              fontSize: "12px",
              lineHeight: "20px",
              fontWeight: 600,
            }}
          >
            ● On the waiting list
          </Text>

          <Heading
            as="h1"
            style={{
              margin: "0 0 6px",
              fontSize: "22px",
              lineHeight: "30px",
              fontWeight: 600,
              letterSpacing: "-0.01em",
              color: color.black,
            }}
          >
            {studentFirstName} is on our waiting list
          </Heading>
          <Text style={{ ...text, color: color.muted, fontSize: "14px", margin: "0 0 24px" }}>
            We&apos;ll let you know as soon as a tutor is available.
          </Text>

          <Text style={text}>Hello {greetingName},</Text>
          <Text style={text}>
            Thank you for applying for Connect Me Tutoring for <strong>{studentName}</strong>! We
            are experiencing very high demand, and we want every tutor matched with a student who is
            ready to make the most of it. We don&apos;t have a tutor available right away, so we
            have added your student to our waiting list.
          </Text>
        </Section>

        {/* Commitments */}
        <Section style={{ padding: "0 28px" }}>
          <Section
            style={{
              border: `1px solid ${color.border}`,
              borderRadius: "8px",
              backgroundColor: color.card,
            }}
          >
            <Section
              style={{
                padding: "14px 16px",
                backgroundColor: color.subtle,
                borderBottom: `1px solid ${color.border}`,
                borderRadius: "8px 8px 0 0",
              }}
            >
              <Text style={{ margin: 0, fontSize: "14px", fontWeight: 600, color: color.black }}>
                Before you&apos;re matched
              </Text>
              <Text
                style={{
                  margin: "2px 0 0",
                  fontSize: "13px",
                  lineHeight: "20px",
                  color: color.muted,
                }}
              >
                If you can commit for at least the next 6 to 12 months, please confirm that:
              </Text>
            </Section>
            {commitments.map((item, i) => (
              <Row
                key={i}
                style={{
                  borderBottom: i < commitments.length - 1 ? `1px solid ${color.border}` : "none",
                }}
              >
                <Column
                  style={{ width: "40px", verticalAlign: "top", padding: "14px 0 14px 16px" }}
                >
                  <Text
                    style={{
                      margin: 0,
                      width: "22px",
                      height: "22px",
                      lineHeight: "22px",
                      borderRadius: "9999px",
                      backgroundColor: color.blue3,
                      color: "#FFFFFF",
                      fontSize: "12px",
                      fontWeight: 600,
                      textAlign: "center",
                    }}
                  >
                    {i + 1}
                  </Text>
                </Column>
                <Column style={{ verticalAlign: "top", padding: "14px 16px 14px 4px" }}>
                  <Text
                    style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: color.black }}
                  >
                    {item}
                  </Text>
                </Column>
              </Row>
            ))}
          </Section>
        </Section>

        {/* Action required */}
        <Section style={{ padding: "24px 28px 0" }}>
          <Section
            style={{
              backgroundColor: color.tint,
              border: `1px solid ${color.blue1}`,
              borderLeft: `4px solid ${color.blue3}`,
              borderRadius: "8px",
              padding: "14px 16px",
            }}
          >
            <Text
              style={{ margin: "0 0 4px", fontSize: "14px", fontWeight: 600, color: color.blue5 }}
            >
              Action needed: reply within {replyWithinHours} hours
            </Text>
            <Text style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: color.gray2 }}>
              Reply to this email if you are still looking for tutoring for your student, and we
              will notify you as soon as a tutor becomes available. If we don&apos;t hear back
              within {replyWithinHours} hours, we may ask you to reapply.
            </Text>
          </Section>
        </Section>

        <Section style={{ padding: "24px 28px 28px" }}>
          <Text style={text}>
            If your plans have changed, no problem. Just <strong>reply all</strong> to this email
            and we will update our list.
          </Text>
          <Text style={{ ...text, margin: 0 }}>Thank you for your understanding and patience.</Text>
          <Hr style={{ borderColor: color.border, margin: "24px 0 16px" }} />
          <Text style={{ margin: 0, fontSize: "14px", lineHeight: "22px", color: color.muted }}>
            Best regards,
          </Text>
          <Text
            style={{
              margin: 0,
              fontSize: "14px",
              lineHeight: "22px",
              fontWeight: 600,
              color: color.black,
            }}
          >
            Connect Me Free Tutoring &amp; Mentoring
          </Text>
        </Section>

        {/* Shared footer with social links; sits flush with the card's rounded bottom. */}
        <EmailFooter tagline="Connect Me Online Tutoring · Connecting Students with Success" />
      </Section>
    </Container>
  );

  if (isPreview) {
    return <div style={{ fontFamily: font, backgroundColor: color.page }}>{content}</div>;
  }

  return (
    <Html>
      <Head />
      <Preview>{`${studentFirstName} is on the Connect Me waiting list. Please reply within ${replyWithinHours} hours.`}</Preview>
      <Body style={{ fontFamily: font, backgroundColor: color.page, margin: 0, padding: 0 }}>
        {content}
      </Body>
    </Html>
  );
}
