import { getAllActiveEnrollmentsServer } from "@/lib/actions/enrollment.server.actions";
import { addDays, endOfWeek, format, parseISO, startOfWeek } from "date-fns";
import { NextResponse, NextRequest } from "next/server";
import { getAllSessionsServer } from "@/lib/actions/session.server.actions";
import { Enrollment, Session } from "@/types";
import { createClient } from "@/lib/supabase/server";
import { fromZonedTime } from "date-fns-tz";
import { Table } from "@/lib/supabase/tables";
import { verifyAdmin } from "@/lib/actions/auth.server.actions";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await verifyAdmin();
    const newSessions = await handleUpdateWeek();

    return NextResponse.json({ newSessions: newSessions }, { status: 200 });
  } catch (error) {
    const err = error as Error;
    return NextResponse.json(
      { error: `Update Week error ${err.message}` },
      { status: 500 },
    );
  }
}

const handleUpdateWeek = async (): Promise<Session[]> => {
  try {
    //------Set Loading-------

    const today = new Date();

    const weekStart = startOfWeek(today).toISOString();
    const weekEnd = endOfWeek(today).toDateString();

    const enrollments = await getAllActiveEnrollmentsServer(weekEnd);
    const sessions: Session[] = await getAllSessionsServer(
      weekStart,
      weekEnd,
      "date",
      true,
    );

    // Create sessions for all enrollments without checking meeting availability
    const newSessions = await addSessionsServer(
      weekStart,
      weekEnd,
      enrollments,
      sessions,
    );
    if (!newSessions) {
      throw new Error("No sessions were created");
    }
    return newSessions;
  } catch (error: any) {
    console.error("Failed to add sessions:", error);
    throw error;
  }
};

async function addSessionsServer(
  weekStartString: string,
  weekEndString: string,
  enrollments: Enrollment[],
  sessions: Session[],
) {
  const supabase = await createClient();

  try {
    const weekStart: Date = fromZonedTime(
      parseISO(weekStartString),
      "America/New_York",
    );
    const weekEnd: Date = fromZonedTime(
      parseISO(weekEndString),
      "America/New_York",
    );

    const now: string = new Date().toISOString();

    //Set created to avoid duplicates
    const scheduledSessions: Set<string> = await getSessionKeys(sessions);

    // skip enrollments that already have a session this week, even if rescheduled to a different time
    const enrollmentsWithSessions: Set<string> = new Set(
      sessions
        .filter((s) => s.enrollmentId)
        .map((s) => s.enrollmentId as string),
    );

    // Prepare bulk insert data
    const sessionsToCreate: any[] = [];

    // Process all enrollments
    for (const enrollment of enrollments) {
      const {
        id,
        student,
        tutor,
        availability,
        meetingId,
        summary,
        startDate,
        duration,
        frequency,
      } = enrollment;

      const startDate_asDate = new Date(startDate); //UTC

      if (enrollment.paused) {
        continue;
      }

      // already has a session this week, probably rescheduled
      if (enrollmentsWithSessions.has(id)) {
        continue;
      }

      if (!student?.id || !tutor?.id || !availability?.length) {
        continue;
      }

      let { day, startTime, endTime } = availability[0];

      if (
        !startTime ||
        !endTime
        // startTime.includes("-") ||
        // endTime.includes("-")
      ) {
        console.error(`Invalid time format in availability:`, availability[0]);
        continue;
      }

      let currentDate = new Date(weekStart);
      const dayLower = day.toLowerCase();

      while (currentDate <= weekEnd) {
        const currentDay = format(currentDate, "EEEE").toLowerCase();

        if (currentDay !== dayLower) {
          currentDate = addDays(currentDate, 1);
          continue;
        }

        if (currentDate < parseISO(weekStartString)) {
          currentDate = addDays(currentDate, 7);
        }

        if (currentDate > parseISO(weekEndString)) {
          currentDate = addDays(currentDate, -7);
        }

        try {
          const [startHour, startMinute] = startTime.split(":").map(Number);
          const [endHour, endMinute] = endTime.split(":").map(Number);

          if (
            isNaN(startHour) ||
            isNaN(startMinute) ||
            isNaN(endHour) ||
            isNaN(endMinute)
          ) {
            throw new Error(
              `Invalid time format: start=${startTime}, end=${endTime}`,
            );
          }

          // Create session date with correct time
          // * SetHours and SetMinutes are dependent on local timezone

          const dateString = `${format(currentDate, "yyyy-MM-dd")}T${startTime}:00`;
          const sessionStartTime = fromZonedTime(
            dateString,
            "America/New_York",
          ); // Automatically handles DST

          if (sessionStartTime < startDate_asDate) {
            throw new Error("Session occurs before start date");
          }

          // Check for duplicate session
          const sessionKey = `${student.id}-${tutor.id}-${format(
            sessionStartTime,
            "yyyy-MM-dd-HH:mm",
          )}`;

          if (!scheduledSessions.has(sessionKey)) {
            // Add to batch insert
            sessionsToCreate.push({
              enrollment_id: id,
              date: sessionStartTime.toISOString(),
              student_id: student.id,
              tutor_id: tutor.id,
              status: "Active",
              summary: summary || "",
              meeting_id: meetingId || null,
              duration: duration,
            });

            // Track this session to avoid duplicates
            scheduledSessions.add(sessionKey);
          } ////
        } catch (err) {
          console.error(
            "Error processing time for %s %s-%s:",
            day,
            startTime,
            endTime,
            err,
          );
        }

        // Move to next day
        currentDate = addDays(currentDate, 1);
      }
    }

    const createdSessions = await batchInsertSessions(sessionsToCreate);
    return createdSessions ? createdSessions : [];
  } catch (error) {
    console.error("Error creating sessions:", error);
    throw error;
  }
}

const batchInsertSessions = async (sessionsToCreate: Session[]) => {
  try {
    const supabase = await createClient();
    if (sessionsToCreate.length > 0) {
      const { data, error } = await supabase
        .from(Table.Sessions)
        .insert(sessionsToCreate).select(`
          *,
          student:Profiles!student_id(*),
          tutor:Profiles!tutor_id(*),
          meeting:Meetings!meeting_id(*)
          `);

      if (error) throw error;

      if (data) {
        // Transform returned data to Session objects
        const transformedSessions: Session[] = data.map((session: any) => ({
          id: session.id,
          enrollmentId: session.enrollment_id,
          createdAt: session.created_at,
          date: session.date,
          summary: session.summary,
          meeting: session.meeting,
          student: session.student,
          tutor: session.tutor,
          status: session.status,
          session_exit_form: session.session_exit_form || null,
          isQuestionOrConcern: session.isQuestionOrConcern,
          isFirstSession: session.isFirstSession,
          duration: session.duration,
        }));

        return transformedSessions;
      }
    }
  } catch (error) {
    console.error("Error with batch insert");
    throw error;
  }
};

export async function getSessionKeys(data?: Session[]) {
  const supabase = await createClient();
  const sessionKeys: Set<string> = new Set();

  if (!data) {
    const { data, error } = await supabase
      .from(Table.Sessions)
      .select("student_id, tutor_id, date");

    if (error) {
      console.error("Error fetching sessions:", error);
      throw error;
    }
  }

  if (!data) return sessionKeys;

  data.forEach((session) => {
    if (session.date) {
      const sessionDate = new Date(session.date);
      const key = `${session.student?.id}-${session.tutor?.id}-${format(
        sessionDate,
        "yyyy-MM-dd-HH:mm",
      )}`;
      sessionKeys.add(key);
    }
  });

  return sessionKeys;
}
