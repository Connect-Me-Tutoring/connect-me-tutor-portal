import { formatDate, formatDateWithOptions, to12HourWithMinutes } from "@/lib/utils";
import { Profile } from "@/types";
import { PairingConfirmationEmailProps } from "@/types/email";
import React from "react";

// Mock utility function since we don't have access to the actual one

export default function TutorPairingConfirmationEmail({
  tutor,
  student,
  availability,
  startDate,
  meeting,
  isPreview = false,
}: PairingConfirmationEmailProps) {
  // Extract data from student object with fallbacks
  const subjects = student.subjects_of_interest || ["TBD"];
  const languages = student.languages_spoken || [""];

  const EmailContent = () => (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#0E5B94",
          color: "#ffffff",
          padding: "24px",
          textAlign: "center",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
          Connect Me Free Tutoring & Mentoring
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: "24px" }}>
        {/* Greeting */}
        <div
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          Dear {tutor.firstName} {tutor.lastName},
        </div>

        {/* Main Message */}
        <div
          style={{
            backgroundColor: "#B7E2F2",
            borderLeft: "4px solid #6AB2D7",
            padding: "16px",
            borderRadius: "0 8px 8px 0",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            Congratulations! You have been matched with a new student:{" "}
            <strong>
              {student.firstName} {student.lastName}
            </strong>
            . Your sessions will occur on <strong>{availability.day}</strong> from{" "}
            <strong>{to12HourWithMinutes(availability.startTime)} EST</strong> to{" "}
            <strong>{to12HourWithMinutes(availability.endTime)} EST</strong> starting on{" "}
            <strong>{formatDateWithOptions(startDate, { month: true, day: true })}</strong>. Please
            reach out to the student or their parent to introduce yourself and coordinate your
            tutoring schedule.
          </div>
        </div>

        {/* Student Information */}
        <div
          style={{
            backgroundColor: "#0B3967",
            border: "1px solid #0E5B94",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#B7E2F2",
              fontSize: "16px",
              margin: "0 0 8px 0",
            }}
          >
            Your Student
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            <strong>Name:</strong> {student.firstName} {student.lastName}
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            <strong>Email:</strong>{" "}
            <a
              href={`mailto:${student.email}`}
              style={{ color: "#B7E2F2", textDecoration: "underline" }}
            >
              {student.email}
            </a>
          </div>
          {student.parentEmail && (
            <div
              style={{
                color: "#ffffff",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0",
              }}
            >
              <strong>Parent Email:</strong> {student.parentEmail}
            </div>
          )}
          {student.parentPhone && (
            <div
              style={{
                color: "#ffffff",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0",
              }}
            >
              <strong>Parent Phone:</strong> {student.parentPhone}
            </div>
          )}
          {student.parentName && (
            <div
              style={{
                color: "#ffffff",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0",
              }}
            >
              <strong>Parent/Guardian:</strong> {student.parentName}
            </div>
          )}
        </div>

        {/* Meeting Link */}
        <div
          style={{
            backgroundColor: "#0E5B94",
            border: "2px solid #6AB2D7",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#B7E2F2",
              fontSize: "18px",
              margin: "0 0 12px 0",
              textAlign: "center",
            }}
          >
            🎯 Join Your Tutoring Session
          </div>
          <div
            style={{
              color: "#ffffff",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
              textAlign: "center",
            }}
          >
            Click the link below to join your scheduled tutoring sessions:
          </div>
          <div
            style={{
              textAlign: "center",
              margin: "0 0 16px 0",
            }}
          >
            <a
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
            </a>
          </div>
          <div
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
            <a href={meeting.link} style={{ color: "#ffffff", textDecoration: "underline" }}>
              {meeting.link}
            </a>
          </div>
        </div>

        {/* Academic Information */}
        <div
          style={{
            backgroundColor: "#6AB2D7",
            border: "1px solid #0E5B94",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#040405",
              fontSize: "16px",
              margin: "0 0 12px 0",
            }}
          >
            Academic Information
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            <strong>Subjects of Interest:</strong> {subjects.join(", ")}
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            <strong>Languages Spoken:</strong> {languages.join(", ")}
          </div>
        </div>

        {/* Next Steps */}
        <div
          style={{
            backgroundColor: "#8494A8",
            border: "1px solid #495860",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#040405",
              fontSize: "16px",
              margin: "0 0 8px 0",
            }}
          >
            Next Steps
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
            }}
          >
            <strong>1.</strong> Contact{" "}
            {student.parentName ? student.parentName : `${student.firstName}'s parent`} to introduce
            yourself and coordinate your tutoring schedule
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
            }}
          >
            <strong>2.</strong> Review the Connect Me Tutor Starter Pack before your first session
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            <strong>3.</strong> Fill out the session exit form after each tutoring session through
            the tutor portal
          </div>
        </div>

        {/* Important Resources */}
        <div
          style={{
            backgroundColor: "#FFF3CD",
            border: "1px solid #FFEAA7",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#856404",
              fontSize: "16px",
              margin: "0 0 12px 0",
            }}
          >
            📚 Important Resources
          </div>
          <div
            style={{
              color: "#856404",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            <strong>Tutor Starter Pack:</strong>{" "}
            <a
              href="https://docs.google.com/document/d/1eVQPX2Rjx-b5n93070zHjXSMpzBs0twwGpRPAOYmHec/edit?tab=t.0#heading=h.kk1966kbedef"
              style={{ color: "#0E5B94", textDecoration: "underline" }}
            >
              Please read before your first session
            </a>
          </div>
          <div
            style={{
              color: "#856404",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            <strong>Tutor Portal:</strong>{" "}
            <a
              href="https://www.connectmego.app/"
              style={{ color: "#0E5B94", textDecoration: "underline" }}
            >
              Access zoom link and complete session forms
            </a>
          </div>
        </div>

        {/* Support Information */}
        <div
          style={{
            backgroundColor: "#F8D7DA",
            border: "1px solid #F5C6CB",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#721C24",
              fontSize: "16px",
              margin: "0 0 8px 0",
            }}
          >
            ⚠️ Action Required
          </div>
          <div
            style={{
              color: "#721C24",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
            }}
          >
            Please reply to this email to confirm that you have received this pairing notification
            and understand your responsibilities as outlined above.
          </div>
          <div
            style={{
              color: "#721C24",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            If you have any concerns about tutoring this student or need assistance, please contact{" "}
            <strong>Yulianna, Addison, or Claudia</strong>.
          </div>
        </div>

        {/* Closing */}
        <div style={{ paddingTop: "16px" }}>
          <div
            style={{
              color: "#30302F",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            Best regards,
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              fontWeight: "bold",
              margin: "0",
            }}
          >
            Connect Me Free Tutoring & Mentoring
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          backgroundColor: "#30302F",
          padding: "16px",
          textAlign: "center",
          borderTop: "1px solid #495860",
        }}
      >
        <div style={{ color: "#8494A8", fontSize: "14px", margin: "0" }}>
          Connect Me Online Tutoring | Connecting Students with Success
        </div>
      </div>
    </div>
  );

  if (isPreview) {
    return (
      <div style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#ffffff" }}>
        <EmailContent />
      </div>
    );
  }

  return (
    <div>
      <EmailContent />
    </div>
  );
}
