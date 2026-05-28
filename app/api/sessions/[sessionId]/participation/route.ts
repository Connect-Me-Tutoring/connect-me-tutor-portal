import { NextRequest, NextResponse } from "next/server";
import { getParticipationBySessionId } from "@/lib/actions/zoom.server.actions";
import { getSessionById } from "@/lib/actions/session.server.actions";

export async function GET(req: NextRequest, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    const sessionId = params.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 }
      );
    }

    // Get session details to calculate meeting end time
    const session = await getSessionById(sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    // Get participation records
    const participationRecords = await getParticipationBySessionId(sessionId);

    // Transform participation records into events format
    const events = participationRecords.map((record) => ({
      id: record.id,
      participantId: record.participant_id,
      name: record.name,
      email: record.email || "",
      action: record.action as "joined" | "left",
      timestamp: record.timestamp,
    }));

    // Sort events by timestamp
    events.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    // Calculate participant summaries
    const participantMap = new Map<
      string,
      {
        id: string;
        name: string;
        email: string;
        totalDuration: number;
        joinCount: number;
        currentlyInMeeting: boolean;
        firstJoined: string;
        lastActivity: string;
      }
    >();

    const sessionStartTime = session.date ? new Date(session.date) : new Date();
    const sessionEndTime = session.duration
      ? new Date(sessionStartTime.getTime() + session.duration * 60 * 1000)
      : null;

    events.forEach((event) => {
      if (!participantMap.has(event.participantId)) {
        participantMap.set(event.participantId, {
          id: event.participantId,
          name: event.name,
          email: event.email,
          totalDuration: 0,
          joinCount: 0,
          currentlyInMeeting: false,
          firstJoined: event.timestamp,
          lastActivity: event.timestamp,
        });
      }

      const summary = participantMap.get(event.participantId)!;
      summary.lastActivity = event.timestamp;

      if (event.action === "joined") {
        summary.joinCount++;
        summary.currentlyInMeeting = true;
      } else {
        summary.currentlyInMeeting = false;
      }
    });

    // Calculate durations for each participant
    participantMap.forEach((summary) => {
      const userEvents = events
        .filter((e) => e.participantId === summary.id)
        .sort(
          (a, b) =>
            new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        );
      let totalDuration = 0;
      let joinTime: Date | null = null;

      for (const event of userEvents) {
        if (event.action === "joined") {
          joinTime = new Date(event.timestamp);
        } else if (event.action === "left" && joinTime !== null) {
          const leaveTime = new Date(event.timestamp);
          totalDuration +=
            (leaveTime.getTime() - joinTime.getTime()) / (1000 * 60);
          joinTime = null;
        }
      }

      // If still in meeting, calculate duration until session end or now
      if (joinTime !== null && summary.currentlyInMeeting) {
        const endTime: Date =
          sessionEndTime !== null ? sessionEndTime : new Date();
        totalDuration += (endTime.getTime() - joinTime.getTime()) / (1000 * 60);
      }

      summary.totalDuration = Math.round(totalDuration);
    });

    const participantSummaries = Array.from(participantMap.values()).sort(
      (a, b) => b.totalDuration - a.totalDuration
    );

    return NextResponse.json({
      session: {
        id: session.id,
        meetingTitle: session.meeting?.name || "Tutoring Session",
        meetingId: session.meeting?.meetingId || "",
        startTime: session.date,
        endTime: sessionEndTime?.toISOString() || null,
        totalDuration: session.duration || 0,
      },
      events,
      participantSummaries,
    });
  } catch (error) {
    console.error("Error fetching participation data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
