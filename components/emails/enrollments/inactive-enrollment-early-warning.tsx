import { Enrollment, Profile } from "@/types";
import {
  emailBadgeHtml,
  emailCalloutHtml,
  emailHeadingHtml,
  emailLayoutHtml,
  emailSignatureHtml,
  emailTextHtml,
  escapeHtml,
} from "@/components/emails/layout/html";

const InactiveEnrollmentEarlyWarning = (params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) => {
  const { tutor, student } = params;
  const tutorFirst = escapeHtml(tutor.firstName);
  const studentFirst = escapeHtml(student.firstName);
  const studentFull = `${studentFirst} ${escapeHtml(student.lastName)}`;

  return emailLayoutHtml({
    preview: `Missing Session Exit Forms for ${student.firstName} ${student.lastName}`,
    content: [
      emailBadgeHtml("Missing Session Exit Forms", "warning"),
      emailHeadingHtml(
        `Missing Session Exit Forms for ${studentFull}`,
        "Your enrollment will deactivate in about two weeks if sessions remain unconfirmed.",
      ),
      emailTextHtml(`Hi ${tutorFirst}!`),
      emailTextHtml(
        `We are writing to let you know that your enrollment with <strong>${studentFull}</strong> has missing Session Exit Forms for the past 3 weeks. If sessions remain unconfirmed, your enrollment will deactivate in about two weeks to free up space for additional tutoring sessions.`,
      ),
      emailCalloutHtml({
        tone: "warning",
        title: "What to do",
        paragraphs: [
          `If your sessions with ${studentFirst} are still active, please fill in the Session Exit Form, and your enrollment will not be removed.`,
          "<strong>If this enrollment is no longer active, please delete it in the Tutor Portal.</strong>",
        ],
      }),
      emailTextHtml(
        "If you were unable to submit a Session Exit Form because of a technical issue, just reply to this email and our team will sort it out.",
      ),
      emailSignatureHtml("Best,"),
    ].join(""),
  });
};

export default InactiveEnrollmentEarlyWarning;
