/**
 * Zoom sends `payload.object.uuid` as Base64-encoded raw UUID bytes (16 bytes).
 * This is not encrypted and does not use `ZOOM_WEBHOOK_SECRET` — decode with Base64 only.
 *
 * The canonical string (8-4-4-4-12) matches what Zoom REST APIs expect for the
 * meeting instance UUID path/query param, but it is **not** the same as the numeric
 * meeting number in `payload.object.id` (used for `Meetings.meeting_id` in this app).
 */
export function decodeZoomWebhookMeetingUuid(
  zoomUuidBase64: string | undefined | null,
): string | null {
  if (!zoomUuidBase64 || typeof zoomUuidBase64 !== "string") return null;
  try {
    let b64 = zoomUuidBase64.trim();
    // URL-safe Base64 (Zoom sometimes uses this in URLs)
    b64 = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = b64.length % 4;
    if (pad) b64 += "=".repeat(4 - pad);
    const buf = Buffer.from(b64, "base64");
    if (buf.length !== 16) return null;
    const hex = buf.toString("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
  } catch {
    return null;
  }
}
