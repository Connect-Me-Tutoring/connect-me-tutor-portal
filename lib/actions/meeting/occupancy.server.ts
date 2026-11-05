import "server-only";
import { addHours, areIntervalsOverlapping } from "date-fns";
import { Table } from "@/lib/supabase/tables";
import { getEnrollmentSchedule } from "@/lib/enrollment-schedule";

// Single source of truth for which bookings occupy a Zoom room. The room dropdowns read
// these through occupancy.server.actions and the server-side guards in room-conflicts
// call them directly, so the UI and the server can never disagree about a room.
// Callers pass a service-role client: RLS hides other tutors' bookings.

export interface EnrollmentMeetingSlotRow {
  id: string;
  meetingId: string;
  day: string | null;
  startTime: string | null;
  endTime: string | null;
  startDate: string | null;
  frequency: string;
  paused: boolean;
}

export interface SessionMeetingSlotRow {
  id: string;
  meetingId: string;
  date: string;
  duration: number;
  enrollmentId: string | null;
}

export interface WeeklySlot {
  day: string | null;
  startTime: string | null;
  endTime: string | null;
}

// Sessions are at most a few hours long, so a 12h look-back catches every overlap.
export const SESSION_LOOKBACK_HOURS = 12;

/**
 * Enrollments that hold a weekly slot in a room as of `at`: everything not past its end
 * date. Paused enrollments keep their slot so it is still free when they resume.
 */
export async function queryEnrollmentMeetingSlots(
  supabase: any,
  options: { meetingId?: string; at?: Date } = {},
): Promise<EnrollmentMeetingSlotRow[]> {
  const at = (options.at ?? new Date()).toISOString();
  let query = supabase
    .from(Table.Enrollments)
    .select("id, meetingId, day, start_time, end_time, start_date, frequency, paused")
    .not("meetingId", "is", null)
    .or(`end_date.is.null,end_date.gte.${at}`);
  if (options.meetingId) query = query.eq("meetingId", options.meetingId);

  const { data } = await query.throwOnError();
  return (data ?? []).map((row: any) => ({
    id: row.id,
    meetingId: row.meetingId,
    day: row.day,
    startTime: row.start_time,
    endTime: row.end_time,
    startDate: row.start_date,
    frequency: row.frequency,
    paused: row.paused,
  }));
}

/**
 * Sessions that occupy their room between `from` and `to` (by start time). Cancelled and
 * rescheduled sessions have released the room, and orphans (enrollment deleted, not a
 * standalone session) never meet.
 */
export async function querySessionMeetingSlots(
  supabase: any,
  range: { from: Date; to: Date },
  meetingId?: string,
): Promise<SessionMeetingSlotRow[]> {
  let query = supabase
    .from(Table.Sessions)
    .select("id, meeting_id, date, duration, enrollment_id, is_standalone")
    .not("meeting_id", "is", null)
    .not("status", "in", "(Cancelled,Rescheduled)")
    .gte("date", range.from.toISOString())
    .lte("date", range.to.toISOString());
  if (meetingId) query = query.eq("meeting_id", meetingId);

  const { data } = await query.throwOnError();
  return (data ?? [])
    .filter((row: any) => row.date && (row.enrollment_id !== null || row.is_standalone))
    .map((row: any) => ({
      id: row.id,
      meetingId: row.meeting_id,
      date: row.date,
      duration: row.duration,
      enrollmentId: row.enrollment_id,
    }));
}

/** Strict overlap of two sessions, so back-to-back bookings are allowed. */
export function sessionsOverlap(
  a: { date: string | Date; duration: number },
  b: { date: string | Date; duration: number },
) {
  const interval = (s: { date: string | Date; duration: number }) => ({
    start: new Date(s.date),
    end: addHours(new Date(s.date), s.duration || 1),
  });
  return areIntervalsOverlapping(interval(a), interval(b));
}

/** Strict overlap of two weekly day/time slots (times as "HH:MM", Eastern). */
export function weeklySlotsOverlap(a: WeeklySlot, b: WeeklySlot) {
  const x = getEnrollmentSchedule(a);
  const y = getEnrollmentSchedule(b);
  if (!x.day || !y.day || !x.startTime || !x.endTime || !y.startTime || !y.endTime) {
    return false;
  }
  return (
    x.day.toLowerCase() === y.day.toLowerCase() &&
    x.startTime < y.endTime &&
    x.endTime > y.startTime
  );
}
