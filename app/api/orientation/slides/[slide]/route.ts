import { NextResponse } from "next/server";

import { getOrientationViewerStatus } from "@/lib/orientation/access.server";
import {
  createOrientationAssetUrl,
  ORIENTATION_REDIRECT_CACHE_CONTROL,
} from "@/lib/orientation/storage.server";

export const runtime = "nodejs";

const SLIDE_FILE_PATTERN = /^slide-(0[1-9]|1\d|2[01])\.webp$/;

export async function GET(_request: Request, { params }: { params: Promise<{ slide: string }> }) {
  const { slide } = await params;

  if (!SLIDE_FILE_PATTERN.test(slide)) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }

  const viewerStatus = await getOrientationViewerStatus();
  if (viewerStatus === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (viewerStatus === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const signedUrl = await createOrientationAssetUrl(`slides/${slide}`);
  if (!signedUrl) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": ORIENTATION_REDIRECT_CACHE_CONTROL },
  });
}
