// lib/tutors.actions.ts

import { supabase } from "@/lib/supabase/client";
import { Profile, Session } from "@/types";
import { getProfileWithProfileId } from "../user/client.actions";
import { getMeeting } from "../admin.actions";
import { Stats } from "fs";
import { Table } from "../../supabase/tables";
import { tableToInterfaceSessions } from "../../utils/type-utils";
import type { Database } from "@/types/database.types";

type SessionStatus = Database["public"]["Enums"]["session_status"];

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
  status?: SessionStatus | SessionStatus[],
  orderby?: string,
  ascending?: boolean,
): Promise<Session[]> {
  let query = supabase
    .from(Table.Sessions)
    .select(
      `
     *,
     meeting:Meetings!meeting_id(*),
     student:Profiles!student_id(*),
     tutor:Profiles!tutor_id(*)
    `,
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
  const sessions: Session[] = data.map(tableToInterfaceSessions);

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

// changed to allow tutors to restore cancelled sessions back to their original status
export async function undoCancelSession(
  sessionId: string,
  originalStatus: SessionStatus = "Active",
) {
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
      .select(
        `*,
        tutor:Profiles!tutor_id(*),
        student:Profiles!student_id(*),
        meeting:Meetings!meeting_id(*)`,
      )
      .single();

    if (error) throw error;

    return tableToInterfaceSessions(data);
  } catch (error) {
    console.error("Error undoing session exit form:", error);
    throw error;
  }
}
