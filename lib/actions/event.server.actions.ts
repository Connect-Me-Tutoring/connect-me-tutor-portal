"use server"

import { createClient } from "@/lib/supabase/server";
import { Event } from "@/types";

/* EVENTS */
export async function getEvents(
  tutorId: string,
  orderBy?: { field: string; ascending: boolean }
): Promise<Event[]> {
  try {
    const supabase = await createClient();

    console.log(orderBy)

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
      `
      )
      .eq("tutor_id", tutorId);

    if (orderBy)
      query = query.order(orderBy.field, { ascending: orderBy.ascending });

    const { data, error } = await query;

    if (error) {
      // Check for errors and log them
      console.error("Error fetching event details:", error.message);
      throw error // Returning null here is valid since the function returns Promise<Notification[] | null>
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
    throw error
  }
}

export async function getEventsWithTutorMonth(
  tutorId: string,
  selectedMonth: string,
): Promise<Event[] | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("Events")
      .select(`id, created_at, date, summary, tutor_id, hours`)
      .eq("tutor_id", tutorId)
      .gte("date", selectedMonth)
      .lt(
        "date",
        new Date(
          new Date(selectedMonth).setMonth(
            new Date(selectedMonth).getMonth() + 1,
          ),
        ).toISOString(),
      );

    if (error) {
      console.error("Error fetching event details:", error.message);
      return null;
    }

    if (!data) return null;

    const events: Event[] = data.map((event: any) => ({
      createdAt: event.created_at,
      id: event.id,
      summary: event.summary,
      tutorId: event.tutor_id,
      date: event.date,
      hours: event.hours,
      type: event.type,
    }));

    return events;
  } catch (error) {
    console.error("Unexpected error in getEventsWithTutorMonth:", error);
    return null;
  }
}

export async function createEvent(event: Event) {
  const supabase = await createClient();
  const { error: eventError } = await supabase.from("Events").insert({
    date: event.date,
    summary: event.summary,
    tutor_id: event.tutorId,
    hours: event.hours,
    type: event.type,
  });

  if (eventError) throw eventError;
}

export async function removeEvent(eventId: string): Promise<boolean> {
  try {
    if (!eventId || typeof eventId !== "string") {
      console.error("Invalid event ID provided:", eventId);
      return false;
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("Events")
      .delete()
      .eq("id", eventId)
      .select();

    if (error) {
      console.error("Error deleting event:", error);
      throw error;
    }

    if (!data || data.length === 0) {
      console.warn(`No event found with ID: ${eventId}`);
      return false;
    }

    return true;
  } catch (error) {
    console.error("Failed to remove event:", error);
    throw error;
  }
}