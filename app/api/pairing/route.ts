import {
  applyPairingWorkflowPreview,
  PairingWorkflowResult,
  runPairingWorkflow,
} from "@/lib/pairing";
import { verifyAdmin } from "@/lib/actions/auth/server.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError } from "@/lib/posthog";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// The preview body goes straight into a Supabase insert, and Array.isArray() was the
// only check on it. Shapes mirror PairingMatchInsert (lib/pairing/index.ts) and
// PairingLogSchemaType (lib/pairing/types.ts) - keep in sync if those change.
const PairingMatchInsertSchema = z.object({
  student_id: z.string().uuid(),
  tutor_id: z.string().uuid(),
  similarity: z.number().finite(),
});

const PairingLogSchema = z.object({
  message: z.string().max(2000),
  type: z.enum([
    "pairing-que-entered",
    "pairing-match",
    "pairing-match-rejected",
    "pairing-match-accepted",
    "pairing-selection-failed",
  ]),
  error: z.boolean().optional(),
  role: z.enum(["student", "tutor"]).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const PairingPreviewSchema = z.object({
  matchesToInsert: z.array(PairingMatchInsertSchema).max(1000),
  logs: z.array(PairingLogSchema).max(2000),
});

/**
 * Vercel cron invokes this path with GET (see vercel.json); a CRON_SECRET-authorized
 * GET runs the workflow. A plain browser visit gets an informational response only.
 */
export async function GET(req: NextRequest) {
  if (isCronRequestAuthorized(req)) {
    try {
      const result = await runPairingWorkflow({ dryRun: false, debug: false });
      return NextResponse.json({
        message: "Successfully completed scheduled pairing process",
        dryRun: false,
        result,
      });
    } catch (error) {
      console.error("Cron job pairing failed:", error);
      await logError(error, {}, "cron_pairing_error");
      return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
  }

  const url = new URL(req.url);
  return NextResponse.json(
    {
      message:
        "Pairing runs on POST only (e.g. from the admin UI or curl). A plain browser visit uses GET and does not run the workflow.",
      usePost: `curl -X POST "${url.origin}${url.pathname}?dryRun=1&debug=1" -H "Content-Type: application/json" -d '{}'`,
    },
    { headers: { Allow: "POST" } },
  );
}

export async function POST(req: NextRequest) {
  try {
    await verifyAdmin();

    const url = new URL(req.url);
    const dryRunParam = url.searchParams.get("dryRun");
    const debugParam = url.searchParams.get("debug");
    const dryRun = dryRunParam === "true" || dryRunParam === "1";
    const debug = debugParam === "true" || debugParam === "1";
    const body = await req.json().catch(() => null);
    const mode = body?.mode as string | undefined;

    if (mode === "apply-preview") {
      const parsedPreview = PairingPreviewSchema.safeParse(body?.preview);
      if (!parsedPreview.success) {
        return NextResponse.json(
          { message: "Invalid preview payload", details: parsedPreview.error.flatten() },
          { status: 400 },
        );
      }

      const preview: Pick<PairingWorkflowResult, "matchesToInsert" | "logs"> = parsedPreview.data;
      const persisted = await applyPairingWorkflowPreview(preview, { debug });
      return NextResponse.json({
        message: "Successfully applied pairing preview",
        persisted,
      });
    }

    const result = await runPairingWorkflow({ dryRun, debug });
    return NextResponse.json({
      message: dryRun
        ? "Successfully completed pairing process preview"
        : "Successfully completed pairing process",
      dryRun,
      debug,
      result,
    });
  } catch (error) {
    console.error("Admin pairing request failed:", error);
    await logError(error, {}, "pairing_admin_error");
    return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
  }
}
