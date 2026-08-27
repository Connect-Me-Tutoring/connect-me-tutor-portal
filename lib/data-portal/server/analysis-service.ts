/**
 * Client for the Connect Me analysis service (FastAPI, from the
 * dataPortalWebsite repo). Server-side only: the service URL and shared
 * secret must never reach a browser bundle.
 *
 * Ported from `dataPortalWebsite/frontend/src/lib/data-analysis/analysis-service.ts`.
 * Two rules shape everything below:
 *
 *  - Nothing the backend says reaches the browser unvalidated. A response that
 *    does not match `analysisResponseSchema` is discarded, not forwarded.
 *  - Nothing the backend says about *why* something failed reaches the browser
 *    either. Failures are logged here and generalised on the way out.
 */

import { analysisResponseSchema, type AnalysisResponse } from "../response-schemas";
import type { AnalysisRequest } from "../schemas";

if (typeof window !== "undefined") {
  throw new Error("data-portal analysis-service client was imported into a client bundle.");
}

/** Analysis work is slower than a page request but not unbounded. */
const TIMEOUT_MS = 20_000;

/**
 * Ceiling on the response body, in bytes. The service caps its own output, so
 * anything near this means the service is not the thing that answered.
 */
const MAX_RESPONSE_BYTES = 256 * 1024;

/**
 * Reads a response body, aborting as soon as the byte cap is exceeded —
 * measured while streaming, in bytes rather than UTF-16 code units, and
 * without trusting `Content-Length`.
 */
async function readCappedText(
  response: Response,
  maxBytes: number,
): Promise<{ ok: true; text: string } | { ok: false; reason: "too-large" | "no-body" }> {
  const declaredLength = Number(response.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    return { ok: false, reason: "too-large" };
  }

  if (!response.body) return { ok: false, reason: "no-body" };

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let received = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    if (!value) continue;

    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      return { ok: false, reason: "too-large" };
    }
    chunks.push(value);
  }

  const buffer = new Uint8Array(received);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }

  return { ok: true, text: new TextDecoder().decode(buffer) };
}

function serviceUrl(): string {
  return process.env.ANALYSIS_SERVICE_URL?.trim() || "http://127.0.0.1:8000";
}

function serviceToken(): string {
  return process.env.ANALYSIS_SERVICE_TOKEN?.trim() ?? "";
}

export type AnalysisServiceOutcome =
  | { ok: true; response: AnalysisResponse }
  | { ok: false; status: number; message: string };

/** False when the backend has not been configured, so callers can say so honestly. */
export function isAnalysisServiceConfigured(): boolean {
  return serviceToken().length > 0;
}

function failure(status: number, message: string): AnalysisServiceOutcome {
  return { ok: false, status, message };
}

export async function requestAnalysis({
  request,
  requestId,
  user,
}: {
  request: AnalysisRequest;
  requestId: string;
  /**
   * The principal, established by the route handler via `requireAdmin()` —
   * never read from the client. The service trusts it because only the holder
   * of the shared secret can present one; it audit-logs tool calls against it.
   */
  user: { id: string; role: "admin" };
}): Promise<AnalysisServiceOutcome> {
  if (!isAnalysisServiceConfigured()) {
    return failure(501, "The analysis service is not configured.");
  }

  const payload = {
    requestId,
    principal: { id: user.id, role: user.role },
    messages: request.messages,
    sourceIds: request.sourceIds,
    dateRange: request.dateRange,
  };

  let response: Response;
  try {
    response = await fetch(`${serviceUrl()}/analyze`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        Authorization: `Bearer ${serviceToken()}`,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (error) {
    const timedOut = error instanceof Error && error.name === "TimeoutError";
    console.error(
      `[data-portal] Analysis service ${timedOut ? "timed out" : "was unreachable"}.`,
      { requestId, userId: user.id },
    );
    return timedOut
      ? failure(504, "The analysis is taking longer than expected. Try a narrower question.")
      : failure(502, "The analysis service is unavailable.");
  }

  if (!response.ok) {
    // The service's own message is deliberately not surfaced. It is written
    // for an operator reading logs, not for an analyst reading a panel.
    console.error("[data-portal] Analysis service returned an error status.", {
      requestId,
      userId: user.id,
      status: response.status,
    });
    return failure(502, "The analysis service could not complete the request.");
  }

  const body = await readCappedText(response, MAX_RESPONSE_BYTES);
  if (!body.ok) {
    console.error("[data-portal] Analysis service response was unusable.", {
      requestId,
      userId: user.id,
      reason: body.reason,
    });
    return failure(502, "The analysis service returned an unexpected response.");
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(body.text);
  } catch {
    console.error("[data-portal] Analysis service returned invalid JSON.", {
      requestId,
      userId: user.id,
    });
    return failure(502, "The analysis service returned an unexpected response.");
  }

  const validated = analysisResponseSchema.safeParse(parsed);
  if (!validated.success) {
    // The two contracts have drifted. Rendering the payload anyway is exactly
    // what the closed-union rule forbids, so it is dropped.
    console.error("[data-portal] Analysis service response failed validation.", {
      requestId,
      userId: user.id,
      issues: validated.error.issues.map((issue) => issue.path.join(".")),
    });
    return failure(502, "The analysis service returned an unexpected response.");
  }

  if (validated.data.requestId !== requestId) {
    console.error("[data-portal] Analysis service echoed a mismatched request id.", {
      requestId,
      userId: user.id,
    });
    return failure(502, "The analysis service returned an unexpected response.");
  }

  return { ok: true, response: validated.data };
}
