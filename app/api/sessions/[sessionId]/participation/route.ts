import { NextRequest, NextResponse } from "next/server";
import { getParticipationData } from "@/lib/actions/session.server.actions";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } },
) {
  try {
    const sessionId = params.sessionId;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Session ID is required" },
        { status: 400 },
      );
    }

    const enrollmentId = req.nextUrl.searchParams.get("enrollmentId");
    const data = await getParticipationData(sessionId, enrollmentId);

    if (!data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching participation data:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 },
    );
  }
}
