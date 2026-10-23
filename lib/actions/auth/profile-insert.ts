import type { Availability, CreatedProfileData } from "@/types";

export interface UserMetadata {
  email: string;
  role: "Student" | "Tutor" | "Admin";
  user_id: string;
  first_name: string | null;
  last_name: string | null;
  age: string;
  grade: string;
  gender: string;
  start_date: string;
  availability: Availability[];
  parent_name: string;
  parent_phone: string;
  parent_email: string;
  phone_number: string;
  timezone: string;
  subjects_of_interest: string[];
  status: "Active";
  student_number: string;
  languages_spoken: string[];
  orientation_completed_at?: null;
}

export function buildUserMetadata(
  newProfileData: CreatedProfileData,
  userId: string,
): UserMetadata {
  return {
    email: newProfileData.email,
    role: newProfileData.role,
    user_id: userId,
    first_name: newProfileData.firstName,
    last_name: newProfileData.lastName,
    age: newProfileData.age,
    grade: newProfileData.grade,
    gender: newProfileData.gender,
    start_date: newProfileData.startDate,
    availability: newProfileData.availability,
    parent_name: newProfileData.parentName,
    parent_phone: newProfileData.parentPhone,
    parent_email: newProfileData.parentEmail,
    phone_number: newProfileData.phoneNumber,
    timezone: newProfileData.timezone,
    subjects_of_interest: newProfileData.subjects_of_interest,
    status: newProfileData.status,
    student_number: newProfileData.studentNumber,
    languages_spoken: newProfileData.languages_spoken,
    // New tutors must complete orientation. Existing tutors are grandfathered
    // separately during rollout, while non-tutor profiles do not use this field.
    ...(newProfileData.role === "Tutor" ? { orientation_completed_at: null } : {}),
  };
}
