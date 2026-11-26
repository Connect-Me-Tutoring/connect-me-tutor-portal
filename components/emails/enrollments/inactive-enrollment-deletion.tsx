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

const InactiveEnrollmentDeletion = (params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) => {
  const { tutor, student } = params;
  const tutorFirst = escapeHtml(tutor.firstName);
  const studentFirst = escapeHtml(student.firstName);
  const studentFull = `${studentFirst} ${escapeHtml(student.lastName)}`;

  return emailLayoutHtml({
    preview: `Your enrollment with ${student.firstName} ${student.lastName} has been deactivated`,
    content: [
      emailBadgeHtml("Enrollment deactivated", "danger"),
      emailHeadingHtml(`Your enrollment with ${studentFull} was deactivated`),
      emailTextHtml(`Hi ${tutorFirst}!`),
      emailTextHtml(
        `We are writing to let you know that your enrollment with <strong>${studentFull}</strong> has deactivated to free up space for additional tutoring sessions.`,
      ),
      emailCalloutHtml({
        title: "Still tutoring?",
        paragraphs: [
          `If you plan to continue sessions with ${studentFirst}, please create a new enrollment with your student.`,
        ],
      }),
      emailTextHtml(
        "If you were unable to submit a Session Exit Form because of a technical issue, just reply to this email and our team will sort it out.",
      ),
      emailSignatureHtml("Best,"),
    ].join(""),
  });
};

export default InactiveEnrollmentDeletion;
