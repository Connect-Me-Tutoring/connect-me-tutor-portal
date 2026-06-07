import { runPairingWorkflow } from "@/lib/pairing";
import { verifyAdmin } from "@/lib/actions/auth.server.actions";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  await verifyAdmin();
  await runPairingWorkflow();
  return NextResponse.json({
    message: "successfully completed pairing process",
  });
}
