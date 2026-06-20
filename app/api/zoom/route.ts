import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { config } from "@/config";
import { logZoomMetadata } from "@/lib/actions/zoom.server.actions";
// import { logZoomMetadata } from "@/lib/actions/zoom.server.actions";
// import { getActiveSessionFromMeetingID } from "@/lib/actions/session.server.actions";

// Use a single signing secret for all Zoom webhooks
const validationSecret = config.zoom.ZOOM_WEBHOOK_SECRET;

export async function POST(
  req: NextRequest,
  { params }: { params: { meeting: string } }
) {
  const body = await req.json();

  if (!validationSecret) {
    return NextResponse.json(
      {
        err: "Webhook secret not configured",
      },
      { status: 500 }
    );
  }

  //  Handle Zoom's URL validation challenge
  if (body.event === "endpoint.url_validation") {
    const hashForValidate = crypto
      .createHmac("sha256", validationSecret)
      .update(body.payload.plainToken)
      .digest("hex");

    return NextResponse.json({
      plainToken: body.payload.plainToken,
      encryptedToken: hashForValidate,
    });
  }
  // Verify authorization header from Zoom
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${validationSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // console.log("Authorization header verified");

  // Handle actual Zoom events
  const event = body?.event;
  const payload = body?.payload;

  // const session = await getActiveSessionFromMeetingID(params.meeting);

  switch (event) {
    case "meeting.started":
      // console.log("Meeting started:", payload?.object?.id);
      break;

    case "meeting.participant_joined":
      {
        const participant = payload?.object?.participant;
        // console.log("JOINED: ", participant);

        await logZoomMetadata({
          session_id: null,
          zoom_meeting_uuid: payload?.object?.uuid ?? null,
          participant_id: participant?.user_id || "",
          name: participant?.user_name || "Unknown",
          email: participant?.email || null,
          action: "joined",
          timestamp: participant?.join_time ?? new Date().toISOString(),
        });
      }
      break;

    case "meeting.participant_left":
      {
        const participant = payload?.object?.participant;

        await logZoomMetadata({
          session_id: null,
          zoom_meeting_uuid: payload?.object?.uuid ?? null,
          participant_id: participant?.user_id || "",
          name: participant?.user_name || "Unknown",
          email: participant?.email || null,
          action: "left",
          timestamp: participant?.leave_time ?? new Date().toISOString(),
        });

        // console.log("Participant left:", participant?.user_name);
      }
      break;

    default:
      console.warn("Unhandled Zoom event:", event);
  }

  return NextResponse.json({ status: "received" });
}
