import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { config } from "@/config";
import {
  logZoomMetadata,
  updateParticipantLeaveTime,
} from "@/lib/actions/zoom.server.actions";
import { resolvePortalSessionForZoomMeetingNumber } from "@/lib/actions/session.server.actions";
import { logEvent, logError, serializeForPosthog } from "@/lib/posthog";
import { decodeZoomWebhookMeetingUuid } from "@/lib/zoom/meeting-uuid";

// Use a single signing secret for all Zoom webhooks
const validationSecret = config.zoom.ZOOM_WEBHOOK_SECRET;

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();

  // console.log("Received Zoom webhook request");
  await logEvent("zoom_webhook_received", {
    request_id: requestId,
    timestamp: new Date().toISOString(),
  });

  let body;
  try {
    body = await req.json();
    await logEvent("zoom_webhook_body_parsed", {
      request_id: requestId,
      event: body?.event,
      has_payload: !!body?.payload,
      has_event: !!body?.event,
      body_keys: Object.keys(body || {}),
      payload_json: serializeForPosthog(body?.payload),
    });
  } catch (error) {
    await logError(error, {
      request_id: requestId,
      step: "body_parsing",
    });
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const payload = body?.payload;
  const event = body?.event;

  // Extract identifying information from the payload
  // Instance UUID: Base64 in the webhook; decode with lib/zoom/meeting-uuid (not the webhook secret)
  const zoomMeetingId = payload?.object?.uuid;
  const zoomMeetingUuidCanonical = decodeZoomWebhookMeetingUuid(zoomMeetingId);
  // Meeting number - the id field contains the meeting number (e.g., "77608067183")
  const meetingNumberRaw =
    payload?.object?.id || payload?.object?.meeting_number;
  const meetingNumber = meetingNumberRaw ? String(meetingNumberRaw) : undefined;
  // Account information at payload level
  const accountId = payload?.account_id;
  const accountEmail = payload?.account_email;
  // Host information
  const hostId = payload?.object?.host_id;
  const hostEmail = payload?.object?.host_email;

  // console.log("Webhook payload:", JSON.stringify(payload, null, 2));
  // console.log("Webhook identifiers:", {
  //   zoomMeetingId,
  //   accountId,
  //   accountEmail,
  //   meetingNumber,
  //   meetingNumberRaw,
  //   hostId,
  //   hostEmail,
  //   event,
  // });

  // Find meeting and active session by meeting number
  let sessionId: string | null = null;
  let meetingRecord: { id: string; meeting_id: string } | null = null;

  // console.log("meetingNumber", meetingNumber);
  if (meetingNumber) {
    try {
      await logEvent("zoom_webhook_finding_meeting_start", {
        request_id: requestId,
        meeting_number: meetingNumber,
      });

      const resolved =
        await resolvePortalSessionForZoomMeetingNumber(meetingNumber);

      if (!resolved) {
        await logEvent("zoom_webhook_meeting_not_found", {
          request_id: requestId,
          meeting_number: meetingNumber,
        });
      } else {
        meetingRecord = resolved.meetingRecord;
        await logEvent("zoom_webhook_meeting_found", {
          request_id: requestId,
          meeting_number: meetingNumber,
          meeting_id: meetingRecord.id,
          stored_meeting_id: meetingRecord.meeting_id,
        });

        if (resolved.sessionId) {
          sessionId = resolved.sessionId;
          await logEvent("zoom_webhook_active_session_found", {
            request_id: requestId,
            meeting_number: meetingNumber,
            meeting_id: meetingRecord.id,
            session_id: sessionId,
          });
        } else {
          await logEvent("zoom_webhook_no_active_session", {
            request_id: requestId,
            meeting_number: meetingNumber,
            meeting_id: meetingRecord.id,
            resolution: "no_session_in_scheduled_window",
          });
        }
      }
    } catch (error) {
      console.error("Error finding meeting/session:", error);
      await logError(error, {
        request_id: requestId,
        step: "finding_meeting_session",
        meeting_number: meetingNumber,
      });
    }
  }

  await logEvent("zoom_webhook_identifiers_extracted", {
    request_id: requestId,
    zoom_meeting_id: zoomMeetingId,
    zoom_meeting_uuid_canonical: zoomMeetingUuidCanonical,
    account_id: accountId,
    account_email: accountEmail,
    meeting_number: meetingNumber,
    meeting_number_raw: meetingNumberRaw,
    host_id: hostId,
    host_email: hostEmail,
    event_type: event,
    has_zoom_meeting_id: !!zoomMeetingId,
    has_account_id: !!accountId,
    has_meeting_number: !!meetingNumber,
    has_session_id: !!sessionId,
    session_id: sessionId,
    meeting_found: !!meetingRecord,
    stored_meeting_id: meetingRecord?.meeting_id,
    internal_meeting_uuid: meetingRecord?.id,
    payload_object_json: serializeForPosthog(payload?.object),
  });

  if (!validationSecret) {
    console.error("⚠️ Zoom webhook secret not configured");
    await logError(new Error("Zoom webhook secret not configured"), {
      request_id: requestId,
      step: "validation_secret_check",
    });
    return NextResponse.json(
      {
        error: "Webhook secret not configured",
      },
      { status: 500 }
    );
  }

  // Handle Zoom's URL validation challenge
  if (event === "endpoint.url_validation") {
    // console.log("Validating webhook URL", {
    //   zoom_meeting_id: zoomMeetingId,
    //   meeting_number: meetingNumber,
    //   account_id: accountId,
    // });
    await logEvent("zoom_webhook_url_validation", {
      request_id: requestId,
      zoom_meeting_id: zoomMeetingId,
      meeting_number: meetingNumber,
      account_id: accountId,
      has_plain_token: !!payload?.plainToken,
    });

    const plainToken = payload?.plainToken;
    if (!plainToken) {
      await logError(new Error("Missing plainToken in validation request"), {
        request_id: requestId,
        step: "url_validation",
      });
      return NextResponse.json(
        { error: "Missing plainToken" },
        { status: 400 }
      );
    }

    const hashForValidate = crypto
      .createHmac("sha256", validationSecret)
      .update(plainToken)
      .digest("hex");

    await logEvent("zoom_webhook_url_validation_complete", {
      request_id: requestId,
      zoom_meeting_id: zoomMeetingId,
      meeting_number: meetingNumber,
      account_id: accountId,
    });

    return NextResponse.json({
      plainToken: plainToken,
      encryptedToken: hashForValidate,
    });
  }

  // Verify authorization from Zoom
  // Zoom may send the token with or without "Bearer " prefix
  const authHeader = req.headers.get("authorization");
  const signature = req.headers.get("x-zm-signature");
  const timestamp = req.headers.get("x-zm-request-timestamp");

  await logEvent("zoom_webhook_authorization_start", {
    request_id: requestId,
    has_auth_header: !!authHeader,
    has_signature: !!signature,
    has_timestamp: !!timestamp,
    zoom_meeting_id: zoomMeetingId,
  });

  let isAuthorized = false;
  let authMethod = "none";

  //Check Authorization header (flexible format)
  if (authHeader) {
    // Remove "Bearer " prefix if present and compare
    const authToken = authHeader.replace(/^Bearer\s+/i, "").trim();
    // Check if it matches the secret (with or without Bearer prefix)
    if (
      authToken === validationSecret ||
      authHeader === `Bearer ${validationSecret}`
    ) {
      isAuthorized = true;
      authMethod = "authorization_header";
    }
  }

  // Method 2: Verify HMAC signature (recommended by Zoom, more secure)
  if (!isAuthorized && signature && timestamp) {
    try {
      const bodyString = JSON.stringify(body);
      const message = `v0:${timestamp}:${bodyString}`;
      const expectedSignature = `v0=${crypto
        .createHmac("sha256", validationSecret)
        .update(message)
        .digest("hex")}`;

      await logEvent("zoom_webhook_hmac_verification", {
        request_id: requestId,
        signature_match: signature === expectedSignature,
        signature_length: signature?.length,
        expected_signature_length: expectedSignature?.length,
      });

      if (signature === expectedSignature) {
        isAuthorized = true;
        authMethod = "hmac_signature";
      }
    } catch (error) {
      console.error("Error verifying HMAC signature:", error);
      await logError(error, {
        request_id: requestId,
        step: "hmac_verification",
      });
    }
  }

  if (!isAuthorized) {
    console.error("❌ Authorization failed", {
      expected: validationSecret.substring(0, 10) + "...",
      receivedAuth: authHeader
        ? `${authHeader
            .replace(/^Bearer\s+/i, "")
            .trim()
            .substring(0, 20)}...`
        : "none",
      receivedSignature: signature
        ? `${signature.substring(0, 20)}...`
        : "none",
      hasTimestamp: !!timestamp,
      zoomMeetingId,
      accountId,
    });
    await logError(new Error("Authorization failed"), {
      request_id: requestId,
      step: "authorization",
      has_auth_header: !!authHeader,
      has_signature: !!signature,
      has_timestamp: !!timestamp,
      zoom_meeting_id: zoomMeetingId,
      account_id: accountId,
    });
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // console.log("✅ Authorization verified for:", {
  //   meeting: zoomMeetingId,
  //   account: accountId,
  //   event,
  // });

  await logEvent("zoom_webhook_authorized", {
    request_id: requestId,
    auth_method: authMethod,
    zoom_meeting_id: zoomMeetingId,
    account_id: accountId,
    event_type: event,
  });

  // Handle actual Zoom events
  await logEvent("zoom_webhook_event_processing_start", {
    request_id: requestId,
    event_type: event,
    zoom_meeting_id: zoomMeetingId,
    account_id: accountId,
  });

  switch (event) {
    case "meeting.started":
      {
        const startTime = payload?.object?.start_time;
        // console.log("Meeting started:", {
        //   meetingId: zoomMeetingId,
        //   accountId,
        //   meetingNumber,
        //   startTime,
        // });

        await logEvent("zoom_meeting_started", {
          request_id: requestId,
          zoom_meeting_id: zoomMeetingId,
          account_id: accountId,
          meeting_number: meetingNumber,
          start_time: startTime,
        });
      }
      break;

    case "meeting.participant_joined":
      {
        const participant = payload?.object?.participant;
        const participantId =
          participant?.user_id || participant?.participant_user_id || "";
        const participantName = participant?.user_name;
        const participantEmail = participant?.email;
          const joinTime = participant?.join_time || new Date().toISOString();

        console.warn("JOINED:", {
          meetingId: zoomMeetingId,
          accountId,
          participantName,
          participantEmail,
          participantId,
        });

        await logEvent("zoom_participant_joined_received", {
          request_id: requestId,
          zoom_meeting_id: zoomMeetingId,
          meeting_number: meetingNumber,
          account_id: accountId,
          participant_id: participantId,
          participant_name: participantName,
          participant_email: participantEmail,
          join_time: joinTime,
          has_participant_id: !!participantId,
          has_participant_name: !!participantName,
          has_participant_email: !!participantEmail,
          participant_object_json: serializeForPosthog(participant),
        });

        if (!sessionId) {
          // Zoom's payload.object.uuid is base64, not a Postgres UUID, and is not
          // Sessions.id — only log participation when we resolved an internal session.
          await logEvent("zoom_participant_join_skipped_no_session", {
            request_id: requestId,
            zoom_meeting_id: zoomMeetingId,
            meeting_number: meetingNumber,
            participant_id: participantId,
            participant_name: participantName,
            reason:
              "No portal session matched this meeting number (meeting missing, no active session, or meeting id mismatch)",
          });
        } else {
          try {
            await logEvent("zoom_participant_join_db_start", {
              request_id: requestId,
              zoom_meeting_id: zoomMeetingId,
              meeting_number: meetingNumber,
              session_id: sessionId,
              participant_id: participantId,
              participant_name: participantName,
            });

            await logZoomMetadata({
              session_id: sessionId,
              participant_id: participantId,
              name: participantName || "Unknown",
              email: participantEmail || null,
              action: "joined",
              timestamp: joinTime,
            });

            await logEvent("zoom_participant_join_db_success", {
              request_id: requestId,
              zoom_meeting_id: zoomMeetingId,
              meeting_number: meetingNumber,
              session_id: sessionId,
              participant_id: participantId,
              participant_name: participantName,
            });

            // console.log(
            //   `✅ Logged join for ${participantName} in meeting ${meetingNumber} (session: ${sessionId || "not found"}, account: ${accountId})`
            // );
          } catch (error) {
            console.error("Error logging participant join:", error);
            await logError(error, {
              request_id: requestId,
              step: "participant_join_db",
              zoom_meeting_id: zoomMeetingId,
              meeting_number: meetingNumber,
              session_id: sessionId,
              participant_id: participantId,
              participant_name: participantName,
              participant_email: participantEmail,
            });
          }
        }
      }
      break;

    case "meeting.participant_left":
      {
        const participant = payload?.object?.participant;
        const leaveTime = participant?.leave_time || new Date().toISOString();
        const leaveReason = participant?.leave_reason || undefined;
        const participantUuid =
          participant?.user_id || participant?.participant_user_id;
        const participantName = participant?.user_name;
        const participantEmail = participant?.email;

        console.warn("Participant left:", {
          meetingId: zoomMeetingId,
          accountId,
          participantName,
          participantUuid,
          leaveTime,
          leaveReason,
        });

        await logEvent("zoom_participant_left_received", {
          request_id: requestId,
          zoom_meeting_id: zoomMeetingId,
          meeting_number: meetingNumber,
          account_id: accountId,
          participant_id: participantUuid,
          participant_name: participantName,
          participant_email: participantEmail,
          leave_time: leaveTime,
          leave_reason: leaveReason,
          has_participant_uuid: !!participantUuid,
          has_participant_name: !!participantName,
          participant_object_json: serializeForPosthog(participant),
        });

        if (!participantUuid) {
          console.warn("⚠️ No participant UUID found in leave event");
          await logEvent("zoom_participant_left_missing_uuid", {
            request_id: requestId,
            zoom_meeting_id: zoomMeetingId,
            meeting_number: meetingNumber,
            session_id: sessionId,
            participant_name: participantName,
            warning: "No participant UUID found in leave event",
          });
          break;
        }

        if (!sessionId) {
          await logEvent("zoom_participant_left_skipped_no_session", {
            request_id: requestId,
            zoom_meeting_id: zoomMeetingId,
            meeting_number: meetingNumber,
            participant_id: participantUuid,
            participant_name: participantName,
            reason:
              "No portal session matched this meeting number (meeting missing, no active session, or meeting id mismatch)",
          });
          break;
        }

        try {
          await logEvent("zoom_participant_left_db_start", {
            request_id: requestId,
            zoom_meeting_id: zoomMeetingId,
            meeting_number: meetingNumber,
            session_id: sessionId,
            participant_id: participantUuid,
            participant_name: participantName,
          });

          await updateParticipantLeaveTime(
            sessionId,
            participantUuid,
            participantName || "Unknown",
            participantEmail || null,
            leaveTime
          );

          await logEvent("zoom_participant_left_db_success", {
            request_id: requestId,
            zoom_meeting_id: zoomMeetingId,
            meeting_number: meetingNumber,
            session_id: sessionId,
            participant_id: participantUuid,
            participant_name: participantName,
          });

          // console.log(
          //   `✅ Logged leave event for ${participantName} in meeting ${meetingNumber} (session: ${sessionId || "not found"}, account: ${accountId})`
          // );
        } catch (error) {
          console.error("Error logging participant leave:", error);
          await logError(error, {
            request_id: requestId,
            step: "participant_left_db",
            zoom_meeting_id: zoomMeetingId,
            meeting_number: meetingNumber,
            session_id: sessionId,
            participant_id: participantUuid,
            participant_name: participantName,
            participant_email: participantEmail,
            leave_time: leaveTime,
          });
        }
      }
      break;

    case "meeting.ended":
      {
        const endTime = payload?.object?.end_time;
        console.warn("Meeting ended:", {
          meetingId: zoomMeetingId,
          accountId,
          endTime,
        });

        await logEvent("zoom_meeting_ended", {
          request_id: requestId,
          zoom_meeting_id: zoomMeetingId,
          account_id: accountId,
          end_time: endTime,
        });
      }
      break;

    default: {
      console.error("Unhandled Zoom event:", event, {
        meetingId: zoomMeetingId,
        accountId,
      });

      await logEvent("zoom_webhook_unhandled_event", {
        request_id: requestId,
        event_type: event,
        zoom_meeting_id: zoomMeetingId,
        account_id: accountId,
        payload_object_json: serializeForPosthog(payload?.object),
      });
    }
  }

  const processingTime = Date.now() - startTime;
  await logEvent("zoom_webhook_processing_complete", {
    request_id: requestId,
    event_type: event,
    zoom_meeting_id: zoomMeetingId,
    meeting_number: meetingNumber,
    account_id: accountId,
    session_id: sessionId,
    processing_time_ms: processingTime,
  });

  return NextResponse.json({
    status: "received",
    meetingId: zoomMeetingId,
    meetingNumber,
    sessionId,
    accountId,
  });
}
