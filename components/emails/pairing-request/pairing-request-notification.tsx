import { Profile } from "@/types";
import { PairingRequestNotificationEmailProps } from "@/types/email";
import React from "react";

export default function PairingRequestNotificationEmail({
  tutor,
  student,
  isPreview = false,
}: PairingRequestNotificationEmailProps) {
  // Extract data from student object with fallbacks
  const subjects = student.subjects_of_interest || ["TBD"];
  const languages = student.languages_spoken || ["English"];

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
            We have found a potential tutoring match for you! Below is information about a student
            who may be a good fit based on your expertise and availability. Please review the
            student&apos;s information and let us know if you&apos;re interested in this pairing
            opportunity.
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
            Potential Student Match
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
            <strong>Grade Level:</strong> {student.grade || "Not specified"}
          </div>
          {student.parentName && (
            <div
              style={{
                color: "#ffffff",
                fontSize: "16px",
                lineHeight: "1.6",
                margin: "0 0 8px 0",
              }}
            >
              <strong>Parent/Guardian:</strong> {student.parentName}
            </div>
          )}
          <div
            style={{
              color: "#ffffff",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            <strong>Preferred Contact:</strong> {student.parentName ? "Parent/Guardian" : "Student"}
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
            <strong>Subjects Needed:</strong> {subjects.join(", ")}
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            <strong>Languages Spoken:</strong> {languages.join(", ")}
          </div>
        </div>

        {/* Interest and Response */}
        <div
          style={{
            backgroundColor: "#D4F6D4",
            border: "1px solid #28A745",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#155724",
              fontSize: "16px",
              margin: "0 0 12px 0",
            }}
          >
            ✅ Interested in This Match?
          </div>
          <div
            style={{
              color: "#155724",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
            }}
          >
            If you`&apos;`re interested in tutoring this student:
          </div>
          <div
            style={{
              color: "#155724",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
              paddingLeft: "16px",
            }}
          >
            • Please navigate to the tutor portal{" "}
            <a href="https://www.connectmego.app/">https://www.connectmego.app/</a>
          </div>
          <div
            style={{
              color: "#155724",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
              paddingLeft: "16px",
            }}
          >
            • Locate the Pairing Dashboard under the Pairings tab
          </div>
          <div
            style={{
              color: "#155724",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
              paddingLeft: "16px",
            }}
          >
            • Accept the pairing request for {student.firstName} {student.lastName}
          </div>
        </div>

        {/* What Happens Next */}
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
            What Happens Next?
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
            }}
          >
            <strong>1.</strong> Visit your Pairing Dashboard and accept the pairing request if
            interested
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
            }}
          >
            <strong>2.</strong> We`&apos;`ll confirm the pairing and provide student contact
            information
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            <strong>3.</strong> You`&apos;`ll receive the Tutor Starter Pack and coordination
            instructions
          </div>
        </div>

        {/* Important Note */}
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
              margin: "0 0 8px 0",
            }}
          >
            📋 Important Note
          </div>
          <div
            style={{
              color: "#856404",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            This is a potential match only. No commitment has been made yet. Please respond within{" "}
            <strong>48 hours</strong> so we can proceed with pairing arrangements or find
            alternative matches for both you and the student.
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
            ❓ Questions or Concerns?
          </div>
          <div
            style={{
              color: "#721C24",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            If you have any questions about this potential match or need assistance, please contact{" "}
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
              margin: "0 0 8px 0",
            }}
          >
            Thank you for your continued dedication to helping students succeed!
          </div>
          <div
            style={{
              color: "#30302F",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
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
            Connect Me Free Tutoring & Mentoring Team
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
          Connect Me Free Tutoring & Mentoring
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
