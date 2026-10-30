"use server";

import { createAdminClient, createClient } from "@/lib/supabase/server";
import { Event } from "@/types";
import { logDestructiveActivity, logEvent, logError } from "@/lib/posthog";
import { requireAdmin } from "../auth/authz.server";

/* EVENTS */
export async function getEvents(
  tutorId: string,
  orderBy?: { field: string; ascending: boolean },
): Promise<Event[]> {
  try {
    const supabase = await createClient();

    await logEvent("event_get_events_start", { tutorId, orderBy: orderBy ?? null });

    let query = supabase
      .from("Events")
      .select(
        `
        id,
        created_at,
        date,
        summary,
        tutor_id,
        hours
      `,
      )
      .eq("tutor_id", tutorId);

    if (orderBy) query = query.order(orderBy.field, { ascending: orderBy.ascending });

    const { data, error } = await query;

    if (error) {
      // Check for errors and log them
      console.error("Error fetching event details:", error.message);
      await logError(
        error,
        { action: "getEvents", tutorId, orderBy: orderBy ?? null },
        "event_error",
      );
      throw error; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      return []; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const events: Event[] = data.map((event: any) => ({
      createdAt: event.created_at,
      id: event.id,
      summary: event.summary,
      tutorId: event.tutor_id,
      date: event.date,
      hours: event.hours,
      type: event.type,
    }));

    return events; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    await logError(
      error,
      { action: "getEvents", tutorId, orderBy: orderBy ?? null },
      "event_error",
    );
    throw error;
  }
}

export async function removeEvent(eventId: string): Promise<boolean> {
  if (!eventId || typeof eventId !== "string") return false;

  const auth = await requireAdmin();
  const supabase = await createAdminClient();
  const { data, error } = await supabase
    .from("Events")
    .delete()
    .eq("id", eventId)
    .select("*")
    .maybeSingle();

  if (error) {
    await logError(error, { action: "removeEvent", event_id: eventId }, "event_error");
    throw error;
  }

  if (!data) return false;

  await logDestructiveActivity({
    actor: {
      type: "user",
      userId: auth.user.id,
      profileId: auth.profile.id,
      role: auth.profile.role,
    },
    source: "removeEvent",
    reason: "manual_event_deletion",
    resourceType: "event",
    resourceId: eventId,
    deletedObject: data,
  });

  return true;
}
