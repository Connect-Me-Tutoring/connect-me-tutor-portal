import { Enrollment, Profile, Session } from "@/types";
const InactiveEnrollmentEarlyWarning = (params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) => {
  const { tutor, student, enrollment } = params;
  return `
    Hi ${tutor.firstName}!, we are writing to let you know that your enrollment with
    ${student.firstName} ${student.lastName} has missing Session Exit Forms for the past 3 weeks.
    If sessions remain unconfirmed, your enrollment will deactivate in about two weeks to free up
    space for additional tutoring sessions. If your sessions with ${student.firstName} are still active, please
    fill in the Session Exit Form, and your enrollment will not be removed. <b>If this enrollment is no longer active, please delete it in the Tutor Portal.</b>
  `;
};

export default InactiveEnrollmentEarlyWarning;
