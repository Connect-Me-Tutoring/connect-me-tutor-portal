import { PHASE_DEVELOPMENT_SERVER } from "next/dist/shared/lib/constants";

interface Profile {
  id: string;
  createdAt: string;
  role: "Student" | "Tutor" | "Admin";
  userId: string;
  firstName: string;
  lastName: string;
  age?: string;
  grade?: string;
  gender?: string;
  dateOfBirth?: string | null;
  startDate: string;
  availability: { day: string; startTime: string; endTime: string }[];
  email: string;
  phoneNumber: string;
  parentName?: string;
  parentPhone?: string;
  parentEmail?: string;
  timeZone: string;
  subjects_of_interest: string[];
  status: "Active" | "Inactive" | "Deleted";
  tutorIds: string[];
  studentNumber: string | null;
  settingsId: string;
  languages_spoken: string[];
}

interface Session {
  id: string;
  enrollmentId: string | null;
  createdAt: string;
  student: Profile | null;
  tutor: Profile | null;
  date: string;
  meeting?: Meeting | null;
  duration: number;
  status: "Active" | "Complete" | "Cancelled" | "Rescheduled";
  session_exit_form: string;
  summary: string;
  isQuestionOrConcern: boolean;
  isFirstSession: boolean;
  isStandalone: boolean;
}

interface Meeting {
  id: string;
  createdAt: string;
  password: string;
  meetingId: string;
  link: string;
  name: string;
}

interface Notification {
  createdAt: string;
  id: string;
  summary: string;
  sessionId: string;
  previousDate: string;
  suggestedDate: string;
  student: Profile | null;
  tutor: Profile | null;
  status: "Active" | "Resolved";
}

// Type for Events
interface Event {
  createdAt: string;
  date: string;
  summary: string;
  tutorId: string;
  id: string;
  hours: number;
  type: string;
}

// Type for Student s
interface Enrollment {
  id: string;
  createdAt: string;
  student: Profile | null;
  tutor: Profile | null;
  summary: string;
  startDate: string;
  endDate: string | null;
  availability: Availability[];
  day?: string | null;
  startTime?: string | null;
  endTime?: string | null;
  meetingId: string;
  paused: boolean;
  duration: number;
  frequency: string;
}

interface Availability {
  day: string;
  startTime: string;
  endTime: string;
}

interface CreatedProfileData {
  role: "Student" | "Tutor" | "Admin";
  firstName: string;
  lastName: string;
  age: string;
  grade: string;
  gender: string;
  startDate: string;
  availability: Availability[];
  email: string;
  parentName: string;
  parentPhone: string;
  parentEmail: string;
  phoneNumber: string;
  timezone: string;
  subjects_of_interest: string[];
  status: "Active";
  studentNumber: string;
  languages_spoken: string[];
  password: string;
}
