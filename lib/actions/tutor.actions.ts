// lib/tutors.actions.ts

import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Profile, Session } from "@/types";
import { getProfileWithProfileId } from "./user.actions";
import { getMeeting } from "./admin.actions";
import { Stats } from "fs";
import { Table } from "../supabase/tables";
import {
  tableToInterfaceMeetings,
  tableToInterfaceProfiles,
} from "../type-utils";

const supabase = createClientComponentClient({
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

/** 
@params 
profileId - profile id of the user
startDate - Start Date in ISO String
endDate - 

*/

export async function getTutorSessions(
  profileId: string,
  startDate?: string,
  endDate?: string,
  status?: string | string[],
  orderby?: string,
  ascending?: boolean
): Promise<Session[]> {
  let query = supabase
    .from(Table.Sessions)
    .select(
      `
     *,
     meeting:Meetings!meeting_id(*),
     student:Profiles!student_id(*),
     tutor:Profiles!tutor_id(*)
    `
    )
    .eq("tutor_id", profileId);

  if (startDate) {
    query = query.gte("date", startDate);
  }
  if (endDate) {
    query = query.lte("date", endDate);
  }

  if (status) {
    if (Array.isArray(status)) {
      query = query.in("status", status);
    } else {
      query = query.eq("status", status);
    }
  }

  if (orderby && ascending !== undefined) {
    query = query.order(orderby, { ascending });
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching student sessions:", error.message);
    throw error;
  }

  // Map the result to the Session interface
  const sessions: Session[] = data.map((session: any) => {
    return {
      id: session.id,
      enrollmentId: session.enrollment_id,
      createdAt: session.created_at,
      environment: session.environment,
      date: session.date,
      summary: session.summary,
      meeting: tableToInterfaceMeetings(session.meeting),
      student: tableToInterfaceProfiles(session.student),
      tutor: tableToInterfaceProfiles(session.tutor),
      status: session.status,
      session_exit_form: session.session_exit_form,
      isQuestionOrConcern: Boolean(session.isQuestionOrConcernO),
      isFirstSession: Boolean(session.isFirstSession),
      duration: session.duration,
    };
  });

  return sessions;
}

export async function getTutorStudents(tutorId: string) {
  try {
    const { data: pairings, error: pairingsError } = await supabase
      .from(Table.Pairings)
      .select("student_id")
      .eq("tutor_id", tutorId);

    if (pairingsError) {
      console.error("Error fetching enrollments:", pairingsError);
      return null;
    }

    const studentIds = pairings.map((pairing) => pairing.student_id);

    const { data: studentProfiles, error: profileError } = await supabase
      .from(Table.Profiles)
      .select("*")
      .in("id", studentIds);

    if (profileError) {
      console.error("Error fetching student profile", profileError);
      return null;
    }

    // Mapping the fetched data to the Profile object
    const userProfiles: Profile[] = studentProfiles.map((profile: any) => ({
      id: profile.id,
      createdAt: profile.created_at,
      role: profile.role,
      userId: profile.user_id,
      firstName: profile.first_name,
      lastName: profile.last_name,
      dateOfBirth: profile.date_of_birth,
      startDate: profile.start_date,
      availability: profile.availability,
      email: profile.email,
      phoneNumber: profile.phone_number,
      parentName: profile.parent_name,
      parentPhone: profile.parent_phone,
      parentEmail: profile.parent_email,
      tutorIds: profile.tutor_ids,
      timeZone: profile.timezone,
      subjects_of_interest: profile.subjects_of_interest,
      status: profile.status,
      studentNumber: profile.student_number,
      settingsId: profile.settings_id,
      languages_spoken: profile.languages_spoken || [],
    }));

    return userProfiles;
  } catch (error) {
    console.error("Unexpected error in getProfile:", error);
    return null;
  }
}


export async function cancelSession(sessionId: string) {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .update({
      status: "CANCELLED",
    })
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

// changed to allow tutors to restore cancelled sessions back to their original status
export async function undoCancelSession(sessionId: string, originalStatus: string = "Active") {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .update({
      status: originalStatus,
    })
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

export async function addSessionNotes(sessionId: string, notes: string) {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .update({
      notes: notes,
    })
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

export async function getTutorAvailability(tutorId: string) {
  const { data, error } = await supabase
    .from("tutor_availability")
    .select("*")
    .eq("tutor_id", tutorId);

  if (error) throw error;
  return data;
}
//
export async function updateTutorAvailability(
  tutorId: string,
  availabilityData: any
) {
  const { data, error } = await supabase
    .from("tutor_availability")
    .upsert({ tutor_id: tutorId, ...availabilityData })
    .eq("tutor_id", tutorId);

  if (error) throw error;
  return data;
}

export async function getTutorResources() {
  const { data, error } = await supabase.from("tutor_resources").select("*");

  if (error) throw error;
  return data;
}

export async function logSessionAttendance(
  sessionId: string,
  attended: boolean
) {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .update({
      attended: attended,
    })
    .eq("id", sessionId)
    .single();

  if (error) throw error;
  return data;
}

export async function recordSessionExitForm(sessionId: string, notes: string) {
  const { data, error } = await supabase
    .from(Table.Sessions)
    .update({
      session_exit_form: notes,
    })
    .eq("id", sessionId)
    .single();
  if (error) throw error;
}

export async function undoSessionExitForm(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from(Table.Sessions)
      .update({
        status: "Active",
        session_exit_form: null,
        is_question_or_concern: false,
        is_first_session: false,
      })
      .eq("id", sessionId)
      .select()
      .single();

    if (error) throw error;

    return data;
  } catch (error) {
    console.error("Error undoing session exit form:", error);
    throw error;
  }
}
