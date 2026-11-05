import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { rateLimit } from "@/lib/security/rate-limit";
import { getDataPortalOverview } from "@/lib/actions/data-portal/server.actions";
import { renderFigures, streamAnswer } from "@/lib/data-portal/analyst-agent";
import {
  claimAssistantQuestion,
  fitHistory,
  limitMessage,
} from "@/lib/data-portal/assistant-limits";
import { dateRangeSchema } from "@/lib/data-portal/overview";
import { logError } from "@/lib/posthog";

export const dynamic = "force-dynamic";

/**
 * Ask a question about the Data Portal's figures.
 *
 * The route reloads the aggregates itself rather than trusting numbers posted
 * by the client, so a tampered request cannot put made-up figures in front of
 * the model and have them answered as fact. That reload is the same read-only
 * server action the page uses, and it checks for an admin a second time.
 *
 * Every question is counted in the database before the model is called, and
 * refused once a limit is reached. See lib/data-portal/assistant-limits.ts for
 * what the limits are and why they live there.
 */

const MessageSchema = z.object({
  // No system role on purpose: a client-sent one would sit next to ours and the
  // model has no way to tell which to trust.
  role: z.enum(["user", "assistant"]),
  // Earlier answers come back up with the history, and they run longer than a
  // question can.
  content: z.string().min(1).max(16_000),
});

const QUESTION_MAX_CHARS = 4000;

const RequestSchema = z.object({
  messages: z
    .array(MessageSchema)
    .min(1)
    .max(60)
    .refine(
      (messages) => {
        const question = messages[messages.length - 1];
        return question.role === "user" && question.content.length <= QUESTION_MAX_CHARS;
      },
      { message: "The last message must be a question of at most 4000 characters." },
    ),
  dateRange: dateRangeSchema,
});

// A first line, per instance, that turns a hot loop away without a database
// round trip. The limits that actually hold are the database's.
const LIMIT = 20;
const WINDOW_MS = 5 * 60 * 1000;

export async function POST(req: Request) {
  let adminUserId: string;
  try {
    const { user } = await requireAdmin();
    adminUserId = user.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`data-portal-chat:${adminUserId}`, LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "That is a lot of questions at once. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: z.infer<typeof RequestSchema>;
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  {
    const parsed = RequestSchema.safeParse(raw);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
    }
    body = parsed.data;
  }

  // Checked here, before the headers go out, so a missing key is a clear 503
  // rather than an answer that starts and then fails.
  if (!process.env.DATA_PORTAL_ANTHROPIC_API_KEY) {
    console.error("[data-portal] DATA_PORTAL_ANTHROPIC_API_KEY is not set.");
    return NextResponse.json(
      { error: "The assistant is not configured on this environment." },
      { status: 503 },
    );
  }

  // Counted only once the request is known to be well formed and answerable,
  // so a malformed one or a missing key does not use up anyone's allowance.
  const claim = await claimAssistantQuestion();
  if (!claim.ok) {
    if (claim.reason === "limited") {
      return NextResponse.json(
        { error: limitMessage(claim.limit) },
        { status: 429, headers: { "Retry-After": String(claim.retryAfterSeconds) } },
      );
    }
    if (claim.reason === "denied") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return NextResponse.json(
      { error: "The assistant is unavailable right now. Try again shortly." },
      { status: 503 },
    );
  }

  const overview = await getDataPortalOverview(body.dateRange);
  if (!overview.ok) {
    return NextResponse.json({ error: overview.error }, { status: 503 });
  }

  try {
    const answer = streamAnswer({
      figures: renderFigures(overview.sections, overview.generatedAt),
      messages: fitHistory(body.messages),
      // A reader who closes the tab stops the model, and the spend, with it.
      signal: req.signal,
    });

    return new Response(answer, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
        "X-RateLimit-Remaining": String(limit.remaining),
      },
    });
  } catch (error) {
    console.error("[data-portal] Chat failed.", error);
    await logError(error, {}, "data_portal_chat_error");
    // The real error goes to the log, not to the browser.
    return NextResponse.json({ error: "The answer could not be generated." }, { status: 500 });
  }
}
