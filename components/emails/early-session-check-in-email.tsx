import { EarlySessionCheckInEmailProps } from "@/types/email";
import {
  Body,
  Container,
  Head,
  Html,
  Link,
  Preview,
  Section,
  Text,
} from "@react-email/components";

const DEFAULT_PORTAL = "https://www.connectmego.app/";
const DEFAULT_GUIDEBOOK =
  "https://drive.google.com/file/d/1vk9neT5FzDfk2ICpW6aeP5B_OL06te8i/view";

export default function EarlySessionCheckInEmail({
  recipientRole,
  tutor,
  student,
  portalUrl = DEFAULT_PORTAL,
  guidebookUrl = DEFAULT_GUIDEBOOK,
  isPreview = false,
}: EarlySessionCheckInEmailProps) {
  const tutorFullName = `${tutor.firstName} ${tutor.lastName}`.trim();
  const studentFullName = `${student.firstName} ${student.lastName}`.trim();

  const parentGreeting =
    student.parentName ||
    `${student.firstName} ${student.lastName}'s parent`;

  const greeting =
    recipientRole === "tutor"
      ? `Dear ${tutorFullName},`
      : `Dear ${parentGreeting},`;

  const previewText =
    recipientRole === "tutor"
      ? `Quick check-in after your first sessions with ${student.firstName}`
      : `Quick check-in on ${student.firstName}'s first tutoring sessions`;

  const EmailContent = () => (
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
        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          {greeting}
        </Text>

        <Section
          style={{
            backgroundColor: "#B7E2F2",
            borderLeft: "4px solid #6AB2D7",
            padding: "16px",
            borderRadius: "0 8px 8px 0",
            margin: "0 0 24px 0",
          }}
        >
          {recipientRole === "tutor" ? (
            <Text
              style={{
                color: "#040405",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0",
              }}
            >
              Now that you have had your first session or two with{" "}
              <strong>{studentFullName}</strong>, we wanted to check in. How are
              things going? If anything feels unclear or you need support,
              we are here for you.
            </Text>
          ) : (
            <Text
              style={{
                color: "#040405",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0",
              }}
            >
              Now that <strong>{student.firstName}</strong> has had their first
              session or two with <strong>{tutorFullName}</strong>, we wanted to
              check in. We hope tutoring is off to a good start. If you have
              questions about scheduling or how sessions work, you can reach
              out to your tutor or to us any time.
            </Text>
          )}
        </Section>

        {recipientRole === "tutor" ? (
          <>
            <Text
              style={{
                color: "#040405",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0 0 16px 0",
              }}
            >
              Please remember to visit the{" "}
              <Link
                href={portalUrl}
                style={{
                  color: "#0E5B94",
                  fontWeight: "bold",
                  textDecoration: "underline",
                }}
              >
                Connect Me Tutor Portal
              </Link>{" "}
              and submit a Session Exit Form (SEF) after each session so we can
              stay up to date on progress.
            </Text>
            <Text
              style={{
                color: "#040405",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0 0 16px 0",
              }}
            >
              You can cancel, reschedule, or add sessions through the portal. For
              more detail, see the{" "}
              <Link
                href={guidebookUrl}
                style={{
                  color: "#0E5B94",
                  fontWeight: "bold",
                  textDecoration: "underline",
                }}
              >
                Connect Me Guidebook
              </Link>
              .
            </Text>
          </>
        ) : (
          <>
            <Text
              style={{
                color: "#040405",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0 0 16px 0",
              }}
            >
              If you need to adjust meeting times or have questions about your
              student&apos;s sessions, you can coordinate with{" "}
              <strong>{tutor.firstName}</strong> at{" "}
              <Link
                href={`mailto:${tutor.email}`}
                style={{
                  color: "#0E5B94",
                  fontWeight: "bold",
                  textDecoration: "underline",
                }}
              >
                {tutor.email}
              </Link>
              . You can also use the{" "}
              <Link
                href={portalUrl}
                style={{
                  color: "#0E5B94",
                  fontWeight: "bold",
                  textDecoration: "underline",
                }}
              >
                Connect Me portal
              </Link>{" "}
              for scheduling and updates when available to your account.
            </Text>
            <Text
              style={{
                color: "#040405",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0 0 16px 0",
              }}
            >
              For general questions about the program, you can reply to this
              email or contact{" "}
              <Link
                href="mailto:ykowalczyk@connectmego.org"
                style={{
                  color: "#0E5B94",
                  fontWeight: "bold",
                  textDecoration: "underline",
                }}
              >
                ykowalczyk@connectmego.org
              </Link>
              .
            </Text>
          </>
        )}

        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          {recipientRole === "tutor"
            ? "If you have any questions, feel free to reach out to us on Discord."
            : "Thank you for being part of the Connect Me community."}
        </Text>

        <Section style={{ paddingTop: "16px" }}>
          <Text
            style={{
              color: "#30302F",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            Best,
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              fontWeight: "bold",
              margin: "0",
            }}
          >
            Connect Me Free Tutoring & Mentoring
          </Text>
        </Section>
      </Section>

      <Section
        style={{
          backgroundColor: "#30302F",
          padding: "16px",
          textAlign: "center",
          borderTop: "1px solid #495860",
        }}
      >
        <Text style={{ color: "#8494A8", fontSize: "14px", margin: "0" }}>
          Connect Me Free Tutoring & Mentoring
        </Text>
      </Section>
    </Container>
  );

  if (isPreview) {
    return (
      <div
        style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}
      >
        <EmailContent />
      </div>
    );
  }

  return (
    <Html>
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}
      >
        <EmailContent />
      </Body>
    </Html>
  );
}
