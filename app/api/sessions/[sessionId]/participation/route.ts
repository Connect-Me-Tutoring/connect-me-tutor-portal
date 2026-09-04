import { NextRequest, NextResponse } from "next/server";
import { getParticipationData, getSessionById } from "@/lib/actions/session/server.actions";
import { requireAuthenticatedUser, requireSessionAccess } from "@/lib/actions/auth/authz.server";
import { logError } from "@/lib/posthog";

export async function GET(req: NextRequest, props: { params: Promise<{ sessionId: string }> }) {
  const params = await props.params;
  try {
    await requireAuthenticatedUser();
    const sessionId = params.sessionId;

    if (!sessionId) {
      return NextResponse.json({ error: "Session ID is required" }, { status: 400 });
    }

    // Authorization: the caller must be the session's tutor, its student, or an Admin.
    const session = await getSessionById(sessionId, { skipAccessCheck: true });
    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }
    try {
      await requireSessionAccess(session);
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const enrollmentId = req.nextUrl.searchParams.get("enrollmentId");
    const data = await getParticipationData(sessionId, enrollmentId);

    if (!data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(data);
  } catch (error) {
    console.error("Error fetching participation data:", error);
    await logError(error, { sessionId: params.sessionId }, "participation_fetch_error");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
