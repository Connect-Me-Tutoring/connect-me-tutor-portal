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

const InactiveEnrollmentWarning = (params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) => {
  const { tutor, student } = params;
  const tutorFirst = escapeHtml(tutor.firstName);
  const studentFirst = escapeHtml(student.firstName);
  const studentFull = `${studentFirst} ${escapeHtml(student.lastName)}`;

  return emailLayoutHtml({
    preview: `Your enrollment with ${student.firstName} ${student.lastName} will deactivate within a week`,
    content: [
      emailBadgeHtml("Deactivating soon", "danger"),
      emailHeadingHtml(
        `Your enrollment with ${studentFull} will deactivate soon`,
        "This will happen within a week unless sessions are confirmed.",
      ),
      emailTextHtml(`Hi ${tutorFirst}!`),
      emailTextHtml(
        `We are writing to let you know that your enrollment with <strong>${studentFull}</strong> will deactivate soon within a week to free up space for additional tutoring sessions.`,
      ),
      emailCalloutHtml({
        tone: "danger",
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

export default InactiveEnrollmentWarning;
