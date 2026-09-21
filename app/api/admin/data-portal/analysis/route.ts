import { NextResponse } from "next/server";
import { z } from "zod/v4";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { rateLimit } from "@/lib/security/rate-limit";
import { ANALYSES, findAnalysis } from "@/lib/analysis/catalog";
import { analysisBackendStatus, runAnalysis } from "@/lib/analysis/runner";

export const dynamic = "force-dynamic";
// The Python run is the slow part; this has to outlast its own timeout.
export const maxDuration = 120;

/**
 * List the analyses an admin may run, and run one.
 *
 * Running one starts a Python subprocess and reads the whole dataset out of
 * Supabase, so it costs far more than a page load. Hence a tighter limit than
 * the chat gets.
 */

const RunSchema = z.object({ id: z.string().min(1).max(100) });

const LIMIT = 6;
const WINDOW_MS = 5 * 60 * 1000;

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const status = analysisBackendStatus();
  return NextResponse.json({
    ready: status.ready,
    reason: status.reason ?? null,
    analyses: ANALYSES.map(({ id, title, question }) => ({ id, title, question })),
  });
}

export async function POST(req: Request) {
  let adminUserId: string;
  try {
    const { user } = await requireAdmin();
    adminUserId = user.id;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = rateLimit(`data-portal-analysis:${adminUserId}`, LIMIT, WINDOW_MS);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "These take a while to run. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RunSchema.safeParse(raw);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Checked here as well as inside the runner, so an unknown id is a 404
  // rather than a generic failure.
  if (!findAnalysis(parsed.data.id)) {
    return NextResponse.json({ error: "Unknown analysis." }, { status: 404 });
  }

  const result = await runAnalysis(parsed.data.id);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 503 });
  }

  return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
}
