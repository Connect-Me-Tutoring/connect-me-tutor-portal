"use server";

import { createClient } from "@/lib/supabase/server";
import { Event } from "@/types";
import { logEvent, logError } from "@/lib/posthog";
import { Table } from "@/lib/supabase/tables";
import { requireTutorProfileAccess } from "../auth/authz.server";

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
        hours,
        type
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

export interface TutorEventHistory {
  tutor: { id: string; firstName: string; lastName: string; email: string };
  events: Event[];
}

/** Every event ever logged for a tutor, newest first. Null when the tutor doesn't exist. */
export async function getTutorEventHistory(tutorId: string): Promise<TutorEventHistory | null> {
  await requireTutorProfileAccess(tutorId);
  const supabase = await createClient();

  const [{ data: tutor, error: tutorError }, { data: events, error: eventsError }] =
    await Promise.all([
      supabase
        .from(Table.Profiles)
        .select("id, first_name, last_name, email")
        .eq("id", tutorId)
        .eq("role", "Tutor")
        .maybeSingle(),
      supabase
        .from(Table.Events)
        .select("id, created_at, date, summary, tutor_id, hours, type")
        .eq("tutor_id", tutorId)
        .order("date", { ascending: false, nullsFirst: false }),
    ]);

  const error = tutorError ?? eventsError;
  if (error) {
    await logError(error, { action: "getTutorEventHistory", tutorId }, "event_error");
    throw error;
  }
  if (!tutor) return null;

  return {
    tutor: {
      id: tutor.id,
      firstName: tutor.first_name ?? "",
      lastName: tutor.last_name ?? "",
      email: tutor.email ?? "",
    },
    events: (events ?? []).map((event) => ({
      createdAt: event.created_at,
      id: event.id,
      summary: event.summary ?? "",
      tutorId: event.tutor_id ?? "",
      date: event.date ?? "",
      hours: event.hours ?? 0,
      type: event.type,
    })),
  };
}
