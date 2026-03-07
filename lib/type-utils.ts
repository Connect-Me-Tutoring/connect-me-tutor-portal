import { Meeting, Profile } from "@/types";

export const tableToInterfaceProfiles = (data: any) => {
  try {
    if (!data) {
      throw new Error("Data is null");
    }

    const userProfile: Profile = {
      id: data.id,
      createdAt: data.created_at,
      role: data.role,
      userId: data.user_id,
      firstName: data.first_name,
      lastName: data.last_name,
      dateOfBirth: data.date_of_birth,
      startDate: data.start_date,
      availability: data.availability,
      email: data.email,
      phoneNumber: data.phone_number,
      parentName: data.parent_name,
      parentPhone: data.parent_phone,
      tutorIds: data.tutor_ids,
      parentEmail: data.parent_email,
      timeZone: data.timezone,
      subjects_of_interest: data.subjects_of_interest,
      languages_spoken: data.languages_spoken,
      status: data.status,
      studentNumber: data.student_number,
      settingsId: data.settings_id,
    };
    return userProfile;
  } catch (error) {
    console.error("Unable to convert to interface for Profiles", error);
    throw error;
  }
};

export const tableToInterfaceMeetings = (data: any) => {
  try {
    if (!data) {
      throw new Error("Data is null");
    }
    const meetings: Meeting = {
      id: data.id,
      createdAt: data.created_at,
      password: data.password,
      meetingId: data.meeting_id,
      link: data.link,
      name: data.name,
    };
    return meetings;
  } catch (error) {
    console.error("Unable to convert to interface for Meetings", error);
    throw error;
  }
};

export const InterfaceToTableProfiles = (data: Profile) => {
  if (!data) {
    throw new Error("Data is null");
  }
  const profile = {
    email: data.email,
    role: data.role,
    user_id: data.userId,
    first_name: data.firstName,
    last_name: data.lastName,
    age: data.age,
    grade: data.grade,
    gender: data.gender,
    start_date: data.startDate,
    availability: data.availability,
    parent_name: data.parentName,
    parent_phone: data.parentPhone,
    parent_email: data.parentEmail,
    phone_number: data.phoneNumber,
    timezone: data.timeZone,
    subjects_of_interest: data.subjects_of_interest,
    status: data.status,
    student_number: data.studentNumber,
    languages_spoken: data.languages_spoken,
  };
  return profile;
};

// export const tableToInterfaceEnrollments = (data: any) => {
//   try {
//     if (!data) {
//       throw new Error("Data is null");
//     }

//     const enrollment: Enrollment = {
//       id: data.id,
//       createdAt: data.created_at,
//       role: data.role,
//       userId: data.user_id,
//       firstName: data.first_name,
//       lastName: data.last_name,
//       dateOfBirth: data.date_of_birth,
//       startDate: data.start_date,
//       availability: data.availability,
//       email: data.email,
//       phoneNumber: data.phone_number,
//       parentName: data.parent_name,
//       parentPhone: data.parent_phone,
//       tutorIds: data.tutor_ids,
//       parentEmail: data.parent_email,
//       timeZone: data.timezone,
//       subjects_of_interest: data.subjects_of_interest,
//       languages_spoken: data.languages_spoken,
//       status: data.status,
//       studentNumber: data.student_number,
//       settingsId: data.settings_id,
//     };
//     return userProfile;
//   } catch (error) {
//     console.error("Unable to convert to interface for Profiles", error);
//     throw error;
//   }
// };
