import { Enrollment, Meeting, Profile, Session } from "@/types";
import { WeeklyMeetingSchedule } from "@/types/meeting";

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

export const tableToInterfaceEnrollments = (data: any) => {
  try {
    if (!data) {
      throw new Error("Data is null");
    }
    const enrollment: Enrollment = {
      id: data.id || "",
      createdAt: data.created_at || "",
      summary: data.summary || "",
      student: data.student ? tableToInterfaceProfiles(data.student) : null,
      tutor: data.tutor ? tableToInterfaceProfiles(data.tutor) : null,
      startDate: data.start_date || "",
      endDate: data.end_date || null,
      day: data.day || null,
      startTime: data.start_time?.slice(0, 5) || null,
      endTime: data.end_time?.slice(0, 5) || null,
      meetingId: data.meetingId || "",
      paused: Boolean(data.paused),
      duration: data.duration || 0,
      frequency: data.frequency || "weekly",
    };
    return enrollment;
  } catch (error) {
    console.error("Unable to convert to interface for Enrollments", error);
    throw error;
  }
};

export const tableToInterfaceSessions = (data: any): Session => {
  if (!data) throw new Error("Data is Null");
  const sessions: Session = {
    id: data.id,
    enrollmentId: data.enrollment_id,
    createdAt: data.created_at,
    date: data.date,
    summary: data.summary,
    meeting: tableToInterfaceMeetings(data.meeting),
    status: data.status,
    student: tableToInterfaceProfiles(data.student),
    tutor: tableToInterfaceProfiles(data.tutor),
    session_exit_form: data.session_exit_form,
    isQuestionOrConcern: data.is_question_or_concern,
    isFirstSession: data.is_first_session,
    isStandalone: data.is_standalone,
    duration: data.duration,
  };
  return sessions;
};

const toHHMM = (t: string | null | undefined): string => (t ?? "").slice(0, 5);

export const tableToInterfaceWeeklyMeetingSchedule = (data: any): WeeklyMeetingSchedule => {
  if (!data) throw new Error("Data is null");
  return {
    id: data.id,
    createdAt: data.created_at,
    meetingId: data.meeting_id,
    title: data.title ?? "",
    description: data.description ?? "",
    dayOfWeek: data.day_of_week,
    startTime: toHHMM(data.start_time),
    endTime: toHHMM(data.end_time),
  };
};

export const interfaceToTableWeeklyMeetingSchedule = (data: WeeklyMeetingSchedule) => {
  if (!data) throw new Error("Data is null");
  return {
    id: data.id,
    created_at: data.createdAt,
    meeting_id: data.meetingId,
    title: data.title,
    description: data.description,
    day_of_week: data.dayOfWeek,
    start_time: data.startTime,
    end_time: data.endTime,
  };
};
