"use server";
import { addHours } from "date-fns";
import { createAdminClient } from "@/lib/supabase/server";
import { requireAuthenticatedProfile } from "../auth/authz.server";
import {
  SESSION_LOOKBACK_HOURS,
  queryEnrollmentMeetingSlots,
  querySessionMeetingSlots,
  type EnrollmentMeetingSlotRow,
  type SessionMeetingSlotRow,
} from "./occupancy.server";

export type { EnrollmentMeetingSlotRow, SessionMeetingSlotRow };

/**
 * RLS limits tutors to their own enrollments and sessions, but choosing a free
 * Zoom link needs every booking. These read with the service role and return
 * only link + time (no student/tutor identities), gated to admins and tutors.
 * The queries are shared with the server-side room guards (room-conflicts.server).
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
  return queryEnrollmentMeetingSlots(supabase);
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
  return querySessionMeetingSlots(supabase, {
    from: addHours(requestedDate, -SESSION_LOOKBACK_HOURS),
    to: addHours(requestedDate, SESSION_LOOKBACK_HOURS),
  });
}
