import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { analysisRequestSchema } from "@/lib/data-portal/schemas";
import { requestAnalysis } from "@/lib/data-portal/server/analysis-service";
import { checkRateLimit } from "@/lib/data-portal/server/rate-limit";
import {
  getClientAddress,
  readJsonBody,
  verifyJsonContentType,
  verifySameOrigin,
} from "@/lib/data-portal/server/request-guards";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The data-portal boundary: the only path from the portal to the analysis
 * service, and the place identity is established.
 *
 * Ordering is deliberate — cheap transport rejections first, so an
 * unauthenticated caller never reaches session or parsing work:
 * same-origin → JSON-only → per-IP limit → admin session → per-user limit →
 * size-capped body → strict schema → proxy with response re-validation.
 *
 * Authentication is the portal's own: `requireAdmin()` re-reads the caller's
 * Supabase session and active-profile role on every request, so a demoted
 * admin loses access immediately. The role forwarded to the analysis service
 * is established here, server-side; nothing the client sends can influence it.
 *
 * The in-memory rate limits here are the cheap first line; the analysis
 * service enforces the real shared per-user ceiling in Postgres (live mode)
 * before touching data.
 */

/** Unauthenticated ceiling, to blunt flooding before session work happens. */
const ANONYMOUS_LIMIT = { limit: 30, windowMs: 60_000 };
/** Per-admin ceiling. Analysis calls are expensive; humans do not exceed this. */
const USER_LIMIT = { limit: 20, windowMs: 60_000 };

const NO_STORE_HEADERS = {
  "Cache-Control": "no-store, no-cache, must-revalidate, private",
  "X-Content-Type-Options": "nosniff",
} as const;

function errorResponse(message: string, status: number, extraHeaders: Record<string, string> = {}) {
  return NextResponse.json(
    { error: message },
    { status, headers: { ...NO_STORE_HEADERS, ...extraHeaders } },
  );
}

export async function POST(request: Request) {
  const origin = verifySameOrigin(request);
  if (!origin.ok) return errorResponse(origin.message, origin.status);

  const contentType = verifyJsonContentType(request);
  if (!contentType.ok) return errorResponse(contentType.message, contentType.status);

  const anonymous = checkRateLimit(`dp-anon:${getClientAddress(request)}`, ANONYMOUS_LIMIT);
  if (!anonymous.allowed) {
    return errorResponse("Too many requests.", 429, {
      "Retry-After": String(anonymous.retryAfterSeconds),
    });
  }

  // requireAdmin() throws rather than returning a verdict; every throw denies.
  // "Admin access required" is a known identity with the wrong role (403);
  // anything else — no session, missing profile, or an upstream failure — is
  // treated as unauthenticated (401), which is the fail-closed direction.
  let adminUserId: string;
  try {
    const { user } = await requireAdmin();
    adminUserId = user.id;
  } catch (error) {
    const wrongRole = error instanceof Error && error.message === "Admin access required";
    return wrongRole ? errorResponse("Forbidden.", 403) : errorResponse("Unauthorized.", 401);
  }

  const perUser = checkRateLimit(`dp-user:${adminUserId}`, USER_LIMIT);
  if (!perUser.allowed) {
    return errorResponse("Too many analysis requests. Please wait a moment.", 429, {
      "Retry-After": String(perUser.retryAfterSeconds),
    });
  }

  const body = await readJsonBody(request);
  if (!body.ok) return errorResponse(body.message, body.status);

  const parsed = analysisRequestSchema.safeParse(body.value);
  if (!parsed.success) {
    // Validation detail stays server-side; echoing it back would describe the
    // accepted shape of an internal boundary to an unauthorized prober.
    console.warn("[data-portal] Rejected malformed analysis request.", {
      userId: adminUserId,
      issues: parsed.error.issues.map((issue) => issue.path.join(".")),
    });
    return errorResponse("Invalid analysis request.", 400);
  }

  // Correlates this request across the portal log and the service's audit log.
  const requestId = crypto.randomUUID();

  const outcome = await requestAnalysis({
    request: parsed.data,
    requestId,
    user: { id: adminUserId, role: "admin" },
  });

  if (!outcome.ok) {
    return errorResponse(outcome.message, outcome.status);
  }

  // Validated against `analysisResponseSchema` inside `requestAnalysis`, so
  // the panel only ever receives shapes it has a renderer for.
  return NextResponse.json(outcome.response, { headers: NO_STORE_HEADERS });
}

/**
 * Everything except POST is refused explicitly, so an unexpected verb cannot
 * fall through to a framework default.
 */
export async function GET() {
  return errorResponse("Method not allowed.", 405, { Allow: "POST" });
}

export const PUT = GET;
export const PATCH = GET;
export const DELETE = GET;
export const HEAD = GET;
export const OPTIONS = GET;
