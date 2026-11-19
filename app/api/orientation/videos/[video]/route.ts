import { NextResponse } from "next/server";

import { ORIENTATION_TRAINING_VIDEO_FILES } from "@/constants/orientation-training-clips";
import { getOrientationViewerStatus } from "@/lib/orientation/access.server";
import {
  createOrientationAssetUrl,
  ORIENTATION_REDIRECT_CACHE_CONTROL,
} from "@/lib/orientation/storage.server";

export const runtime = "nodejs";

const allowedVideoFiles = new Set<string>(ORIENTATION_TRAINING_VIDEO_FILES);

// Redirects to Supabase Storage, which handles byte-range requests for seeking.
export async function GET(_request: Request, { params }: { params: Promise<{ video: string }> }) {
  const { video } = await params;
  if (!allowedVideoFiles.has(video)) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const viewerStatus = await getOrientationViewerStatus();
  if (viewerStatus === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (viewerStatus === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const signedUrl = await createOrientationAssetUrl(`videos/${video}`);
  if (!signedUrl) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": ORIENTATION_REDIRECT_CACHE_CONTROL },
  });
}
