"use server";
import { addHours } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedProfile } from "../auth/authz.server";

export interface EnrollmentMeetingSlotRow {
  id: string;
  meetingId: string;
  day: string | null;
  startTime: string | null;
  endTime: string | null;
}

export interface SessionMeetingSlotRow {
  id: string;
  meetingId: string;
  date: string;
  duration: number;
}

/**
 * RLS limits tutors to their own enrollments and sessions, but choosing a free
 * Zoom link needs every booking. These read with the service role and return
 * only link + time (no student/tutor identities), gated to admins and tutors.
 */
async function requireTutorOrAdmin() {
  const { profile } = await requireAuthenticatedProfile();
  if (profile.role !== "Admin" && profile.role !== "Tutor") {
    throw new Error("Tutor or admin access required");
  }
}

export async function getEnrollmentMeetingSlots(): Promise<EnrollmentMeetingSlotRow[]> {
  await requireTutorOrAdmin();
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("Enrollments")
    .select("id, meetingId, day, start_time, end_time")
    .not("meetingId", "is", null);
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    meetingId: row.meetingId as string,
    day: row.day,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}

export async function getSessionMeetingSlots(
  requestedDateIso: string,
): Promise<SessionMeetingSlotRow[]> {
  await requireTutorOrAdmin();
  const requestedDate = new Date(requestedDateIso);
  if (Number.isNaN(requestedDate.getTime())) {
    throw new Error("Invalid date");
  }
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("Sessions")
    .select("id, meeting_id, date, duration")
    .not("meeting_id", "is", null)
    .gte("date", addHours(requestedDate, -12).toISOString())
    .lte("date", addHours(requestedDate, 12).toISOString());
  if (error) throw error;
  return (data ?? []).map((row) => ({
    id: row.id,
    meetingId: row.meeting_id as string,
    date: row.date as string, // non-null: the range filter above excludes null dates
    duration: row.duration,
  }));
}
