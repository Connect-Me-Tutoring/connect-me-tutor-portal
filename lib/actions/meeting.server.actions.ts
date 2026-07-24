"use server";
import { Availability, Enrollment, Meeting, Profile, Session } from "@/types";
// import { createClient } from "@supabase/supabase-js";
import { getSupabase } from "../supabase-server/serverClient";
import { createClient } from "@/lib/supabase/server";
import { fetchDaySessionsFromSchedule } from "./session.actions";
import { addHours, areIntervalsOverlapping, isValid, parseISO } from "date-fns";
import { Table } from "../supabase/tables";
import { logError } from "@/lib/posthog";

export async function getMeeting(id: string): Promise<Meeting | null> {
  try {
    const supabase = await createClient();
    // Fetch meeting details from Supabase
    const { data, error } = await supabase
      .from("Meetings")
      .select(
        `
        id,
        link,
        meeting_id,
        password,
        created_at,
        name
      `,
      )
      .eq("id", id)
      .single();

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      await logError(error, { action: "getMeeting", meetingId: id }, "meeting_error");
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }
    // Check if data exists
    if (!data) {
      return null; // Valid return
    }
    // Mapping the fetched data to the Notification object
    const meeting: Meeting = {
      id: data.id,
      name: data.name,
      meetingId: data.meeting_id,
      password: data.password,
      link: data.link,
      createdAt: data.created_at,
    };
    return meeting; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    await logError(error, { action: "getMeeting", meetingId: id }, "meeting_error");
    return null; // Valid return
  }
}

export async function getMeetings(options?: { omit?: string[] }): Promise<Meeting[] | null> {
  const supabase = await createClient();
  try {
    const omittedLinks = options ? (options.omit ? options.omit : []) : [];

    // Fetch meeting details from Supabase
    const { data, error } = await supabase
      .from(Table.Meetings)
      .select(
        `
        id,
        link,
        meeting_id,
        password,
        created_at,
        name
      `,
      )
      .neq("name", omittedLinks);

    // Check for errors and log them
    if (error) {
      console.error("Error fetching event details:", error.message);
      await logError(error, { action: "getMeetings", omit: omittedLinks }, "meeting_error");
      return null; // Returning null here is valid since the function returns Promise<Notification[] | null>
    }

    // Check if data exists
    if (!data) {
      return []; // Valid return
    }

    // Mapping the fetched data to the Notification object
    const meetings: Meeting[] = await Promise.all(
      data.map(async (meeting: any) => ({
        id: meeting.id,
        name: meeting.name,
        meetingId: meeting.meeting_id,
        password: meeting.password,
        link: meeting.link,
        createdAt: meeting.created_at,
        // name: meeting.name,
      })),
    );

    return meetings; // Return the array of notifications
  } catch (error) {
    console.error("Unexpected error in getMeeting:", error);
    await logError(error, { action: "getMeetings" }, "meeting_error");
    return null; // Valid return
  }
}
