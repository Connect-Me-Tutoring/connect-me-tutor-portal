import "server-only";
import { addHours, format } from "date-fns";
import { toZonedTime } from "date-fns-tz";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import { SHAREABLE_MEETING_NAME } from "@/constants/meetings";
import { isEnrollmentSessionDate } from "@/lib/enrollment-schedule";
import { EASTERN_TIMEZONE, getEasternWeekBounds } from "@/lib/utils/timezone";
import {
  SESSION_LOOKBACK_HOURS,
  queryEnrollmentMeetingSlots,
  querySessionMeetingSlots,
  sessionsOverlap,
  weeklySlotsOverlap,
  type WeeklySlot,
} from "./occupancy.server";

// Server-side Zoom room double-booking guards. The enrollment and session forms only check
// availability when the room dropdown opens, so changing the day/time afterwards (or any
// path that skips the form) could book a room that is already taken. Kept out of the
// "use server" occupancy module so these are not callable from the client; both use the
// same occupancy queries (occupancy.server) so they agree on what counts as a booking.
// Reads use the service role: RLS hides other tutors' bookings, and occupancy needs them all.

export const ROOM_TAKEN_MESSAGE =
  "That Zoom link is already booked at this time. Please choose another link.";

async function isShareableMeeting(supabase: any, meetingId: string) {
  const { data } = await supabase
    .from(Table.Meetings)
    .select("name")
    .eq("id", meetingId)
    .maybeSingle()
    .throwOnError();
  return data?.name === SHAREABLE_MEETING_NAME;
}

async function getWeeklyMeetingSchedules(supabase: any, meetingId: string): Promise<WeeklySlot[]> {
  const { data } = await supabase
    .from("weekly_meeting_schedules")
    .select("day_of_week, start_time, end_time")
    .eq("meeting_id", meetingId)
    .throwOnError();
  return (data ?? []).map((row: any) => ({
    day: row.day_of_week,
    startTime: row.start_time,
    endTime: row.end_time,
  }));
}

/** Rejects a weekly slot that overlaps another enrollment or weekly meeting in the room. */
export async function assertRoomFreeForEnrollment(
  slot: { meetingId: string; day: string; startTime: string; endTime: string },
  excludeEnrollmentId?: string,
) {
  const supabase = await createAdminClient();
  if (await isShareableMeeting(supabase, slot.meetingId)) return;

  const [enrollments, schedules] = await Promise.all([
    queryEnrollmentMeetingSlots(supabase, { meetingId: slot.meetingId }),
    getWeeklyMeetingSchedules(supabase, slot.meetingId),
  ]);

  const clash =
    enrollments.some((e) => e.id !== excludeEnrollmentId && weeklySlotsOverlap(slot, e)) ||
    schedules.some((schedule) => weeklySlotsOverlap(slot, schedule));

  if (clash) throw new Error(ROOM_TAKEN_MESSAGE);
}

/** The Eastern weekday and wall-clock times a one-off session occupies. */
function sessionWeeklySlot(start: Date, end: Date): WeeklySlot {
  const zonedStart = toZonedTime(start, EASTERN_TIMEZONE);
  const zonedEnd = toZonedTime(end, EASTERN_TIMEZONE);
  const sameDay = format(zonedStart, "yyyy-MM-dd") === format(zonedEnd, "yyyy-MM-dd");
  return {
    day: format(zonedStart, "EEEE"),
    startTime: format(zonedStart, "HH:mm"),
    endTime: sameDay ? format(zonedEnd, "HH:mm") : "24:00",
  };
}

/**
 * Rejects a one-off session time that overlaps anything else in the room: another live
 * session, a weekly meeting, or the weekly slot of an enrollment whose session for that
 * week has not been generated yet (the add-sessions cron only builds one week ahead).
 */
export async function assertRoomFreeForSession(
  slot: { meetingId: string; date: string; durationHours: number },
  exclude: { sessionId?: string; enrollmentId?: string | null } = {},
) {
  const supabase = await createAdminClient();
  if (await isShareableMeeting(supabase, slot.meetingId)) return;

  const start = new Date(slot.date);
  const end = addHours(start, slot.durationHours);
  const weekly = sessionWeeklySlot(start, end);

  const [sessions, schedules, enrollments] = await Promise.all([
    querySessionMeetingSlots(
      supabase,
      { from: addHours(start, -SESSION_LOOKBACK_HOURS), to: end },
      slot.meetingId,
    ),
    getWeeklyMeetingSchedules(supabase, slot.meetingId),
    queryEnrollmentMeetingSlots(supabase, { meetingId: slot.meetingId, at: start }),
  ]);

  const requested = { date: start, duration: slot.durationHours };
  if (
    sessions.some((s) => s.id !== exclude.sessionId && sessionsOverlap(requested, s)) ||
    schedules.some((schedule) => weeklySlotsOverlap(weekly, schedule))
  ) {
    throw new Error(ROOM_TAKEN_MESSAGE);
  }

  // Enrollments that will meet in this slot that week. Paused ones generate no sessions.
  const { weekStart, weekEnd } = getEasternWeekBounds(start);
  const slotDate = format(toZonedTime(start, EASTERN_TIMEZONE), "yyyy-MM-dd");
  const candidates = enrollments.filter(
    (e) =>
      e.id !== exclude.enrollmentId &&
      !e.paused &&
      (!e.startDate || new Date(e.startDate) <= end) &&
      isEnrollmentSessionDate(e, slotDate) &&
      weeklySlotsOverlap(weekly, e),
  );
  if (candidates.length === 0) return;

  // Once a week's session exists (even cancelled or moved), the session check above is
  // authoritative for that enrollment; only ungenerated weeks still hold the weekly slot.
  const { data: generated } = await supabase
    .from(Table.Sessions)
    .select("enrollment_id")
    .in(
      "enrollment_id",
      candidates.map((e) => e.id),
    )
    .gte("date", weekStart.toISOString())
    .lte("date", weekEnd.toISOString())
    .throwOnError();
  const hasSession = new Set((generated ?? []).map((row: any) => row.enrollment_id));

  if (candidates.some((e) => !hasSession.has(e.id))) {
    throw new Error(ROOM_TAKEN_MESSAGE);
  }
}
