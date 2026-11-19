import { Enrollment, Profile, Session } from "@/types";
const InactiveEnrollmentDeletion = (params: {
  tutor: Profile;
  student: Profile;
  enrollment: Enrollment;
}) => {
  const { tutor, student, enrollment } = params;
  return `
    Hi ${tutor.firstName}!, we are writing to let you know that your enrollment with
    ${student.firstName} ${student.lastName} has deactivated to free up 
    space for additional tutoring sessions. If you plan to continue sessions with ${student.firstName}, please
    create a new enrollment with your student
    <br><br>
    If you were unable to submit a Session Exit Form because of a technical issue, just reply to
    this email and our team will sort it out.
  `;
};

export default InactiveEnrollmentDeletion;
