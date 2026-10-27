import "server-only";
import { addHours, areIntervalsOverlapping } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";
import { Table } from "@/lib/supabase/tables";
import type { Database } from "@/types/database.types";

type DayOfWeek = Database["public"]["Enums"]["day_of_week"];

// Server-side Zoom room double-booking guards. The enrollment and session forms only check
// availability when the room dropdown opens, so changing the day/time afterwards (or any
// path that skips the form) could book a room that is already taken. Kept out of the
// "use server" occupancy module so these are not callable from the client.
// Reads use the service role: RLS hides other tutors' bookings, and occupancy needs them all.

export const ROOM_TAKEN_MESSAGE =
  "That Zoom link is already booked at this time. Please choose another link.";

// HQ is shared on purpose; the enrollment form never disables it either.
const SHAREABLE_MEETING_NAME = "Zoom Link HQ";

async function isShareableMeeting(supabase: any, meetingId: string) {
  const { data } = await supabase
    .from(Table.Meetings)
    .select("name")
    .eq("id", meetingId)
    .maybeSingle()
    .throwOnError();
  return data?.name === SHAREABLE_MEETING_NAME;
}

/** Rejects a weekly slot that overlaps another enrollment or weekly meeting in the room. */
export async function assertRoomFreeForEnrollment(
  slot: { meetingId: string; day: string; startTime: string; endTime: string },
  excludeEnrollmentId?: string,
) {
  const supabase = await createAdminClient();
  if (await isShareableMeeting(supabase, slot.meetingId)) return;

  let enrollmentQuery = supabase
    .from(Table.Enrollments)
    .select("id")
    .eq("meetingId", slot.meetingId)
    .eq("day", slot.day)
    .lt("start_time", slot.endTime)
    .gt("end_time", slot.startTime)
    .limit(1);
  if (excludeEnrollmentId) enrollmentQuery = enrollmentQuery.neq("id", excludeEnrollmentId);

  const [{ data: enrollmentClash }, { data: scheduleClash }] = await Promise.all([
    enrollmentQuery.throwOnError(),
    supabase
      .from("weekly_meeting_schedules")
      .select("id")
      .eq("meeting_id", slot.meetingId)
      .eq("day_of_week", slot.day as DayOfWeek)
      .lt("start_time", slot.endTime)
      .gt("end_time", slot.startTime)
      .limit(1)
      .throwOnError(),
  ]);

  if (enrollmentClash?.length || scheduleClash?.length) {
    throw new Error(ROOM_TAKEN_MESSAGE);
  }
}

/** Rejects a one-off session time that overlaps another live session in the room. */
export async function assertRoomFreeForSession(
  slot: { meetingId: string; date: string; durationHours: number },
  excludeSessionId?: string,
) {
  const supabase = await createAdminClient();
  if (await isShareableMeeting(supabase, slot.meetingId)) return;

  const start = new Date(slot.date);
  const end = addHours(start, slot.durationHours);

  // Sessions are at most a few hours long, so a 12h look-back catches every overlap.
  let query = supabase
    .from(Table.Sessions)
    .select("id, date, duration, enrollment_id, is_standalone")
    .eq("meeting_id", slot.meetingId)
    .not("status", "in", "(Cancelled,Rescheduled)")
    .gte("date", addHours(start, -12).toISOString())
    .lt("date", end.toISOString());
  if (excludeSessionId) query = query.neq("id", excludeSessionId);

  const { data } = await query.throwOnError();

  const clash = (data ?? []).some(
    (session: {
      date: string | null;
      duration: number;
      enrollment_id: string | null;
      is_standalone: boolean;
    }) =>
      // Orphans (enrollment deleted, not a standalone session) never meet; don't let them
      // block a real booking.
      session.date !== null &&
      (session.enrollment_id !== null || session.is_standalone) &&
      areIntervalsOverlapping(
        { start, end },
        {
          start: new Date(session.date),
          end: addHours(new Date(session.date), session.duration || 1),
        },
      ),
  );

  if (clash) throw new Error(ROOM_TAKEN_MESSAGE);
}
