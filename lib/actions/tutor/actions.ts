"use server";

import { createClient } from "@/lib/supabase/server";
import { Profile, Session } from "@/types";
import { Table } from "../../supabase/tables";
import { tableToInterfaceSessions } from "../../utils/type-utils";
import {
  requireAuthenticatedProfile,
  requireSessionAccessById,
  requireTutorProfileAccess,
} from "../auth/authz.server";
import type { Database } from "@/types/database.types";
import type {
  SubmitSessionExitFormInput,
  SubmitSessionExitFormResult,
} from "@/types/sessionExitForm";
import { removeSessionReminders } from "@/lib/email/session-reminders";
import { logError } from "@/lib/posthog";

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
  await requireTutorProfileAccess(profileId);
  const supabase = await createClient();

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
    await requireTutorProfileAccess(tutorId);
    const supabase = await createClient();

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
  const supabase = await requireSessionAccessById(sessionId);
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
  const supabase = await requireSessionAccessById(sessionId);
  const { error } = await supabase
    .from(Table.Sessions)
    .update({
      session_exit_form: notes,
    })
    .eq("id", sessionId)
    .single();
  if (error) throw error;
}

const SESSION_WITH_RELATIONS = `*,
        tutor:Profiles!tutor_id(*),
        student:Profiles!student_id(*),
        meeting:Meetings!meeting_id(*)`;

/**
 * Completes a session's exit form in one conditional write. Only Active sessions and overdue
 * (Unconfirmed) ones can be completed; that status filter is also the duplicate guard: a second
 * submit (double click, second tab, retry after a slow response) finds the session Complete and
 * matches no row instead of completing it again. Never resolves to a silent null;
 * callers get a typed result and must check `ok` before telling the user it worked.
 */
export async function submitSessionExitForm(
  input: SubmitSessionExitFormInput,
): Promise<SubmitSessionExitFormResult> {
  const { sessionId, isQuestionOrConcern, isFirstSession } = input;
  const notes = typeof input.notes === "string" ? input.notes.trim() : "";
  if (!sessionId || !notes) {
    return { ok: false, reason: "invalid" };
  }

  try {
    const supabase = await requireSessionAccessById(sessionId);
    const { data, error } = await supabase
      .from(Table.Sessions)
      .update({
        status: "Complete",
        session_exit_form: notes,
        is_question_or_concern: isQuestionOrConcern,
        is_first_session: isFirstSession,
      })
      .eq("id", sessionId)
      .in("status", ["Active", "Unconfirmed"])
      .select(SESSION_WITH_RELATIONS)
      .maybeSingle();

    if (error) throw error;

    if (!data) {
      // Nothing matched: find out why so the form can say something accurate.
      const { data: current, error: currentError } = await supabase
        .from(Table.Sessions)
        .select(SESSION_WITH_RELATIONS)
        .eq("id", sessionId)
        .maybeSingle();
      if (currentError) throw currentError;
      if (current?.status === "Complete") {
        return {
          ok: false,
          reason: "already_submitted",
          session: tableToInterfaceSessions(current),
        };
      }
      return { ok: false, reason: "not_active" };
    }

    // The form is saved at this point; reminder cleanup must not turn that into a failure.
    // The reminder send route re-checks the session before sending anything.
    try {
      await removeSessionReminders(sessionId);
    } catch (reminderError) {
      await logError(reminderError, { session_id: sessionId }, "email_error");
    }

    return { ok: true, session: tableToInterfaceSessions(data) };
  } catch (error) {
    console.error("Failed to submit session exit form:", error);
    await logError(error, { session_id: sessionId }, "sef_error");
    return { ok: false, reason: "error" };
  }
}

export async function undoSessionExitForm(sessionId: string) {
  try {
    const supabase = await requireSessionAccessById(sessionId);
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
