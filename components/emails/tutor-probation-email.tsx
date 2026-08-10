import { Profile } from "@/types";
import React from "react";

interface TutorProbationEmailProps {
  tutor: Profile;
  reason: string;
  monitoringWindowDays?: number;
  replyWithinHours?: number;
  isPreview?: boolean;
}

export default function TutorProbationEmail({
  tutor,
  reason,
  monitoringWindowDays = 28,
  replyWithinHours = 72,
  isPreview = false,
}: TutorProbationEmailProps) {
  const EmailContent = () => (
    <div
      style={{
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
        fontFamily: "Arial, sans-serif",
        backgroundColor: "#ffffff",
      }}
    >
      {/* Header */}
      <div
        style={{
          backgroundColor: "#0E5B94",
          color: "#ffffff",
          padding: "24px",
          textAlign: "center",
          borderRadius: "8px 8px 0 0",
        }}
      >
        <div style={{ fontSize: "24px", fontWeight: "bold", margin: "0" }}>
          Connect Me Free Tutoring & Mentoring
        </div>
      </div>

      {/* Main Content */}
      <div style={{ padding: "24px", border: "1px solid #e0e0e0", borderTop: "none", borderRadius: "0 0 8px 8px" }}>
        {/* Warning Banner */}
        <div
          style={{
            backgroundColor: "#F8D7DA",
            border: "1px solid #F5C6CB",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
            color: "#721C24",
            fontWeight: "bold",
            textAlign: "center",
            fontSize: "18px",
          }}
        >
          ⚠️ MEMBERSHIP STATUS: PROBATION
        </div>

        {/* Greeting */}
        <div
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 20px 0",
          }}
        >
          Dear {tutor.firstName} {tutor.lastName},
        </div>

        {/* Notice & Reason */}
        <div
          style={{
            color: "#040405",
            fontSize: "16px",
            lineHeight: "1.6",
            margin: "0 0 20px 0",
          }}
        >
          This email serves as formal notification that your membership with Connect Me Tutoring has been placed on probationary status.
        </div>

        <div
          style={{
            backgroundColor: "#F8F9FA",
            borderLeft: "4px solid #6C757D",
            padding: "16px",
            margin: "0 0 24px 0",
            borderRadius: "0 8px 8px 0",
          }}
        >
          <div
            style={{
              color: "#333333",
              fontSize: "16px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            At Connect Me, we maintain high professional standards for our volunteers, and your recent activity has not met these requirements. Specifically, you have <strong>{reason}</strong>. As a result, your continued involvement with the organization is now under formal review.
          </div>
        </div>

        {/* Obligations Checklist */}
        <div
          style={{
            backgroundColor: "#F4F6F8",
            border: "1px solid #D1D5DB",
            borderRadius: "8px",
            padding: "20px",
            margin: "0 0 24px 0",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              color: "#0B3967",
              fontSize: "16px",
              margin: "0 0 16px 0",
            }}
          >
            📋 Required Obligations to Return to Good Standing
          </div>
          <div
            style={{
              color: "#040405",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 16px 0",
            }}
          >
            To return to good standing, you are expected to fulfill the following obligations in the monitoring window of <strong>{monitoringWindowDays} days</strong>, effective immediately upon this email:
          </div>
          <ul
            style={{
              margin: "0",
              paddingLeft: "20px",
              color: "#040405",
              fontSize: "15px",
              lineHeight: "1.8",
            }}
          >
            <li style={{ marginBottom: "8px" }}>
              Attend all mandatory bi-weekly meetings.
            </li>
            <li style={{ marginBottom: "8px" }}>
              Respond to Discord messages from leadership members within 12 hours.
            </li>
            <li style={{ marginBottom: "8px" }}>
              Submit all Session Exit Forms (SEFs) through the Tutor Portal after every session.
            </li>
            <li style={{ marginBottom: "0" }}>
              Maintain professional and timely communication with your students and their parents.
            </li>
          </ul>
        </div>

        {/* Final Opportunity Alert */}
        <div
          style={{
            color: "#040405",
            fontSize: "15px",
            lineHeight: "1.6",
            margin: "0 0 24px 0",
          }}
        >
          Please understand that this period is your final opportunity to demonstrate the commitment and professionalism required of our members. Failure to comply with these guidelines, or any further violations of organization policy, will result in the immediate termination of your membership.
        </div>

        {/* Action Required Box */}
        <div
          style={{
            backgroundColor: "#FFF3CD",
            border: "1px solid #FFEAA7",
            borderRadius: "8px",
            padding: "16px",
            margin: "0 0 24px 0",
            color: "#856404",
          }}
        >
          <div
            style={{
              fontWeight: "bold",
              fontSize: "16px",
              margin: "0 0 8px 0",
            }}
          >
            ⚠️ Action Required
          </div>
          <div
            style={{
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 8px 0",
            }}
          >
            You must <strong>"reply all"</strong> directly to this email within <strong>{replyWithinHours} hours</strong> to confirm your continued participation in Connect Me. Failure to respond within this timeframe will result in the termination of your membership.
          </div>
          <div
            style={{
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0",
            }}
          >
            If you have any questions regarding your probationary status, please <strong>"reply all"</strong> to this thread.
          </div>
        </div>

        {/* Closing */}
        <div style={{ paddingTop: "8px", marginBottom: "24px" }}>
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

        {/* Footer */}
        <div
          style={{
            backgroundColor: "#30302F",
            padding: "16px",
            textAlign: "center",
            borderRadius: "4px",
            margin: "0 -24px -24px -24px",
          }}
        >
          <div style={{ color: "#8494A8", fontSize: "14px", margin: "0" }}>
            Connect Me Online Tutoring | Connecting Students with Success
          </div>
        </div>
      </div>
    </div>
  );

  if (isPreview) {
    return (
      <div style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f8f9fa", padding: "20px 0" }}>
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
