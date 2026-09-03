import {
  applyPairingWorkflowPreview,
  PairingWorkflowResult,
  runPairingWorkflow,
} from "@/lib/pairing";
import { verifyAdmin } from "@/lib/actions/auth/server.actions";
import { isCronRequestAuthorized } from "@/lib/security/cron";
import { logError } from "@/lib/posthog";
import { NextRequest, NextResponse } from "next/server";

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
      return NextResponse.json(
        { success: false, error: "Internal Server Error" },
        { status: 500 },
      );
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
  await verifyAdmin();

  try {
    const url = new URL(req.url);
    const dryRunParam = url.searchParams.get("dryRun");
    const debugParam = url.searchParams.get("debug");
    const dryRun = dryRunParam === "true" || dryRunParam === "1";
    const debug = debugParam === "true" || debugParam === "1";
    const body = await req.json().catch(() => null);
    const mode = body?.mode as string | undefined;

    if (mode === "apply-preview") {
      const preview = body?.preview as
        Pick<PairingWorkflowResult, "matchesToInsert" | "logs"> | undefined;

      if (!preview || !Array.isArray(preview.matchesToInsert) || !Array.isArray(preview.logs)) {
        return NextResponse.json({ message: "Invalid preview payload" }, { status: 400 });
      }

      const persisted = await applyPairingWorkflowPreview(preview, { debug });
      return NextResponse.json({
        message: "Successfully applied saved pairing preview",
        persisted,
        dryRun: false,
        debug,
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
