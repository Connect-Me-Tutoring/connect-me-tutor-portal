import { Enrollment, Profile, Session } from "@/types";
const InactiveEnrollmentWarning = (params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) => {
  const { tutor, student, enrollment } = params;
  return `
    Hi ${tutor.firstName}!, we are writing to let you know that your enrollment with
    ${student.firstName} ${student.lastName} will deactivate soon within a week to free up 
    space for additional tutoring sessions. If your sessions with ${student.firstName} are still active, please
    fill in the Session Exit Form, and your enrollment will not be removed.
  `;
};

export default InactiveEnrollmentWarning;
