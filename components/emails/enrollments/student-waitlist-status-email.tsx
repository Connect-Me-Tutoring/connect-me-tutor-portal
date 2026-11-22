import React from "react";

export const STUDENT_WAITLIST_STATUS_SUBJECT = "Connect Me Tutoring Status";

export interface StudentWaitlistStatusEmailProps {
  parentName?: string | null;
  studentName: string;
  replyWithinHours?: number;
  isPreview?: boolean;
}

const bodyText: React.CSSProperties = {
  color: "#040405",
  fontSize: "16px",
  lineHeight: "1.6",
  margin: "0 0 20px 0",
};

/**
 * Sent to a newly added student's parent when no tutor has been found yet: places
 * the student on the waiting list and asks the parent to confirm their commitment.
 */
export default function StudentWaitlistStatusEmail({
  parentName,
  studentName,
  replyWithinHours = 48,
  isPreview = false,
}: StudentWaitlistStatusEmailProps) {
  const greetingName = parentName?.trim() || `${studentName}'s parent`;

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
      <div
        style={{
          padding: "24px",
          border: "1px solid #e0e0e0",
          borderTop: "none",
          borderRadius: "0 0 8px 8px",
        }}
      >
        <div style={bodyText}>Hello {greetingName},</div>

        <div style={bodyText}>
          Thank you for applying for Connect Me Tutoring for <strong>{studentName}</strong>! We are
          currently experiencing very high demand for tutoring, and we want to make sure every tutor
          is matched with a student who is ready to make the most of it. Currently, we do not have
          an immediate tutor available, but we have added your student to our waiting list.
        </div>

        {/* Commitment Checklist */}
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
              color: "#040405",
              fontSize: "15px",
              lineHeight: "1.6",
              margin: "0 0 12px 0",
            }}
          >
            If you are interested in tutoring and prepared to commit for at least the next{" "}
            <strong>6 to 12 months</strong>, please confirm that:
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
              Your student will attend every scheduled session
            </li>
            <li style={{ marginBottom: "8px" }}>
              You will monitor your email and reply to our messages within 24 hours
            </li>
            <li style={{ marginBottom: "8px" }}>
              You will complete onboarding promptly once you are paired
            </li>
            <li style={{ marginBottom: "0" }}>
              You will maintain consistent communication with your student&apos;s tutor. If
              communication breaks down due to repeated unresponsiveness on the parent&apos;s end,
              your student may no longer be eligible to receive tutoring through Connect Me.
            </li>
          </ul>
        </div>

        <div style={bodyText}>
          If your plans have changed, no problem. Just let us know by <strong>replying all</strong>{" "}
          to this email, and we will update our list.
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
            fontSize: "15px",
            lineHeight: "1.6",
          }}
        >
          Please reply to this email within <strong>{replyWithinHours} hours</strong> if you are
          still looking to receive tutoring for your student, and we will notify you as soon as a
          tutor becomes available. Please note that we might ask you to reapply if you are unable to
          reply within this timeframe. Thank you for your understanding and patience.
        </div>

        {/* Closing */}
        <div style={{ paddingTop: "8px", marginBottom: "24px" }}>
          <div style={{ ...bodyText, color: "#30302F", margin: "0" }}>Best regards,</div>
          <div style={{ ...bodyText, fontWeight: "bold", margin: "0" }}>
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
      <div
        style={{ fontFamily: "Arial, sans-serif", backgroundColor: "#f8f9fa", padding: "20px 0" }}
      >
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
