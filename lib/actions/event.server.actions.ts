"use server";

import { createClient } from "@/lib/supabase/server";
import { Event } from "@/types";

/* EVENTS */
export async function getEvents(
  tutorId: string,
  orderBy?: { field: string; ascending: boolean },
): Promise<Event[]> {
  try {
    const supabase = await createClient();

    console.log(orderBy);

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
    throw error;
  }
}
