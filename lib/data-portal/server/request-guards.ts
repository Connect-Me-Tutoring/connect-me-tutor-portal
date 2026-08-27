/**
 * Transport-level guards for the data-portal boundary. Server-side only.
 *
 * Ported from `dataPortalWebsite/frontend/src/lib/data-analysis/request-guards.ts`.
 * These run before authentication so malformed, oversized, or cross-site
 * requests are rejected cheaply, without touching session or data code.
 */

// Poor man's `server-only`: this module must never reach a client bundle.
if (typeof window !== "undefined") {
  throw new Error("data-portal server guards were imported into a client bundle.");
}

/** Cap on a request body, applied while streaming rather than after buffering. */
export const MAX_REQUEST_BODY_BYTES = 96 * 1024;

export type GuardFailure = { ok: false; status: number; message: string };
export type GuardSuccess<T> = { ok: true; value: T };
export type GuardResult<T> = GuardSuccess<T> | GuardFailure;

/**
 * Origin the browser is expected to have loaded the app from.
 *
 * Pin `DATA_PORTAL_ALLOWED_ORIGIN` (e.g. https://www.connectmego.app) in
 * production. Without it the origin is derived from the forwarded host, which
 * is only trustworthy behind a proxy that overwrites those headers (Vercel
 * does).
 */
function expectedOrigin(request: Request): string | null {
  const configured = process.env.DATA_PORTAL_ALLOWED_ORIGIN;
  if (configured) return configured.replace(/\/+$/, "");

  const headers = request.headers;
  const host = headers.get("x-forwarded-host") ?? headers.get("host");
  if (!host) return null;

  const proto =
    headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

/**
 * Cross-site request forgery guard.
 *
 * A browser sets `Origin` and `Sec-Fetch-Site` itself and a page cannot forge
 * either, so comparing them to this app's own origin rejects requests
 * initiated by another site. The endpoint is consumed only by the portal's own
 * front end, so requests carrying neither header — non-browser clients — are
 * refused as well.
 */
export function verifySameOrigin(request: Request): GuardResult<null> {
  const site = request.headers.get("sec-fetch-site");
  const origin = request.headers.get("origin");

  if (!site && !origin) {
    return { ok: false, status: 403, message: "Request origin could not be verified." };
  }

  if (site && site !== "same-origin") {
    return { ok: false, status: 403, message: "Cross-site requests are not accepted." };
  }

  if (origin) {
    const expected = expectedOrigin(request);
    if (!expected || origin.replace(/\/+$/, "") !== expected) {
      return { ok: false, status: 403, message: "Cross-site requests are not accepted." };
    }
  }

  return { ok: true, value: null };
}

/** Rejects anything that is not a JSON payload, so form-style CSRF cannot apply. */
export function verifyJsonContentType(request: Request): GuardResult<null> {
  const contentType = request.headers.get("content-type");
  if (!contentType) {
    return { ok: false, status: 415, message: "A JSON request body is required." };
  }

  const mediaType = contentType.split(";", 1)[0]!.trim().toLowerCase();
  if (mediaType !== "application/json") {
    return { ok: false, status: 415, message: "A JSON request body is required." };
  }

  return { ok: true, value: null };
}

/**
 * Reads and parses a JSON body, aborting as soon as the byte cap is exceeded.
 *
 * The declared `Content-Length` is checked first as a fast path, but it is
 * absent under chunked encoding and can simply lie, so the stream is measured
 * as it arrives. Nothing oversized is ever fully buffered.
 */
export async function readJsonBody(
  request: Request,
  maxBytes: number = MAX_REQUEST_BODY_BYTES,
): Promise<GuardResult<unknown>> {
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, status: 413, message: "Request body is too large." };
  }

  if (!request.body) {
    return { ok: false, status: 400, message: "Request body is missing." };
  }

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;

      received += value.byteLength;
      if (received > maxBytes) {
        await reader.cancel();
        return { ok: false, status: 413, message: "Request body is too large." };
      }
      chunks.push(value);
    }
  } catch {
    return { ok: false, status: 400, message: "Request body could not be read." };
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { ok: true, value: JSON.parse(new TextDecoder().decode(buffer)) };
  } catch {
    return { ok: false, status: 400, message: "Request body is not valid JSON." };
  }
}

/**
 * Best-effort client address for pre-authentication rate limiting.
 *
 * Only trustworthy behind a proxy that overwrites `x-forwarded-for`. Where it
 * can be spoofed, the per-user limit applied after authentication is the real
 * control; this one only blunts unauthenticated flooding.
 */
export function getClientAddress(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown";
}
