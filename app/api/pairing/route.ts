import {
  applyPairingWorkflowPreview,
  PairingWorkflowResult,
  runPairingWorkflow,
} from "@/lib/pairing";
import { NextRequest, NextResponse } from "next/server";

/** Opening this URL in a browser uses GET; the workflow only runs on POST */
export async function GET(req: NextRequest) {
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
  const url = new URL(req.url);
  const dryRunParam = url.searchParams.get("dryRun");
  const debugParam = url.searchParams.get("debug");
  const dryRun = dryRunParam === "true" || dryRunParam === "1";
  const debug = debugParam === "true" || debugParam === "1";
  const body = await req.json().catch(() => null);
  const mode = body?.mode as string | undefined;

  if (mode === "apply-preview") {
    const preview = body?.preview as
      | Pick<PairingWorkflowResult, "matchesToInsert" | "logs">
      | undefined;

    if (!preview || !Array.isArray(preview.matchesToInsert) || !Array.isArray(preview.logs)) {
      return NextResponse.json(
        { message: "Invalid preview payload" },
        { status: 400 },
      );
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
}
