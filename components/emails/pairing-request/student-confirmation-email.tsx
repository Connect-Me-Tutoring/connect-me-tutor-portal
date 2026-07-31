import { formatDateWithOptions, to12HourWithMinutes } from "@/lib/utils";
import { Availability, Meeting, Profile } from "@/types";
import { PairingConfirmationEmailProps } from "@/types/email";
import { Html, Head, Body, Container, Text, Link, Section } from "@react-email/components";

export default function StudentPairingConfirmationEmail({
  student,
  tutor,
  startDate,
  availability,
  meeting,
  isPreview = false,
}: PairingConfirmationEmailProps) {
  // Helper function to get pronouns based on gender
  const getPronouns = (gender: string) => {
    switch (gender) {
      case "male":
        return { subject: "he", object: "him", possessive: "his" };
      case "female":
        return { subject: "she", object: "her", possessive: "her" };
      default:
        return { subject: "they", object: "them", possessive: "their" };
    }
  };

  // const pronouns = getPronouns(studentGender);

  const EmailContent = () => (
    <Container style={{ maxWidth: "600px", margin: "0 auto", padding: "20px" }}>
      {/* Header */}
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

      {/* Main Content */}
      <Section style={{ padding: "24px" }}>
        {/* Greeting */}
        <Text
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          Dear {student.parentName || student.firstName + " " + student.lastName + "'s parent"},
        </Text>

        {/* Main Message */}
        <Section
          style={{
            backgroundColor: "#B7E2F2",
            borderLeft: "4px solid #6AB2D7",
            padding: "16px",
            borderRadius: "0 8px 8px 0",
            margin: "0 0 24px 0",
          }}
        >
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            We are excited to let you know that {student.firstName} {student.lastName} has been
            matched with a tutor! Your sessions will occur on <strong>{availability.day}</strong>{" "}
            from <strong>{to12HourWithMinutes(availability.startTime)} EST</strong> to{" "}
            <strong>{to12HourWithMinutes(availability.endTime)} EST</strong> on{" "}
            <strong>{formatDateWithOptions(startDate, { month: true, day: true })}</strong>. If
            unable to attend these sessions, please reach out to {tutor.email} to arrange a
            different time
          </Text>
        </Section>

        {/* Tutor Information */}
        <Section
          style={{
            backgroundColor: "#0B3967",
            border: "1px solid #0E5B94",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <Text
            style={{
              fontWeight: "bold",
              color: "#B7E2F2",
              fontSize: "16px",
              margin: "0 0 8px 0",
            }}
          >
            Your Tutor
          </Text>
          <Text
            style={{
              color: "#ffffff",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            <strong>Name:</strong> {tutor.firstName} {tutor.lastName}
          </Text>
          <Text
            style={{
              color: "#ffffff",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            <strong>Email:</strong>{" "}
            <Link
              href={`mailto:${tutor.email}`}
              style={{ color: "#B7E2F2", textDecoration: "underline" }}
            >
              {tutor.email}
            </Link>
          </Text>
        </Section>

        {/* Meeting Link */}
        <Section
          style={{
            backgroundColor: "#0E5B94",
            border: "2px solid #6AB2D7",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <Text
            style={{
              fontWeight: "bold",
              color: "#B7E2F2",
              fontSize: "18px",
              margin: "0 0 12px 0",
              textAlign: "center",
            }}
          >
            🎯 Join Your Tutoring Session
          </Text>
          <Text
            style={{
              color: "#ffffff",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
              textAlign: "center",
            }}
          >
            Click the link below to join your scheduled tutoring sessions:
          </Text>
          <Text
            style={{
              textAlign: "center",
              margin: "0 0 16px 0",
            }}
          >
            <Link
              href={meeting.link}
              style={{
                backgroundColor: "#B7E2F2",
                color: "#0E5B94",
                padding: "12px 24px",
                borderRadius: "6px",
                textDecoration: "none",
                fontWeight: "bold",
                fontSize: "16px",
                display: "inline-block",
              }}
            >
              Join Meeting
            </Link>
          </Text>
          <Text
            style={{
              color: "#B7E2F2",
              fontSize: "14px",
              lineHeight: "1.4",
              margin: "0",
              textAlign: "center",
              wordBreak: "break-all",
            }}
          >
            Or copy this link:{" "}
            <Link href={meeting.link} style={{ color: "#ffffff", textDecoration: "underline" }}>
              {meeting.link}
            </Link>
          </Text>
        </Section>

        {/* Portal Instructions */}
        <Section
          style={{
            backgroundColor: "#6AB2D7",
            border: "1px solid #0E5B94",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <Text
            style={{
              fontWeight: "bold",
              color: "#040405",
              fontSize: "16px",
              margin: "0 0 8px 0",
            }}
          >
            Next Steps
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
            }}
          >
            In the meantime, we recommend that you create an account on the Connect Me Tutor Portal
            so you can easily access the zoom link and communicate with the tutor through the
            website.
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            Please check your inbox and spam for an email from Connect Me to sign up for our tutor
            portal.
          </Text>
        </Section>

        {/* Support Information */}
        <Section
          style={{
            backgroundColor: "#8494A8",
            border: "1px solid #495860",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <Text
            style={{
              fontWeight: "bold",
              color: "#040405",
              fontSize: "16px",
              margin: "0 0 8px 0",
            }}
          >
            Need Help?
          </Text>
          <Text
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            If you experience any issues, please reach out to{" "}
            <Link
              href="mailto:ykowalczyk@connectmego.org"
              style={{ color: "#0E5B94", textDecoration: "underline", fontWeight: "bold" }}
            >
              ykowalczyk@connectmego.org
            </Link>{" "}
            for assistance.
          </Text>
        </Section>

        {/* Closing */}
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

      {/* Footer */}
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
      <div style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}>
        <EmailContent />
      </div>
    );
  }

  return (
    <Html>
      <Head />
      <Body style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}>
        <EmailContent />
      </Body>
    </Html>
  );
}
