import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { getOrientationViewerStatus } from "@/lib/orientation/access.server";
import { isTutorOrientationEnabled } from "@/lib/orientation/config.server";

export const runtime = "nodejs";

const SLIDE_FILE_PATTERN = /^slide-(0[1-9]|1\d|2[01])\.webp$/;

export async function GET(_request: Request, { params }: { params: Promise<{ slide: string }> }) {
  if (!isTutorOrientationEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

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

  try {
    const slidePath = path.join(process.cwd(), "private", "orientation", "slides", slide);
    const { size } = await stat(slidePath);
    const imageStream = Readable.toWeb(createReadStream(slidePath)) as ReadableStream<Uint8Array>;

    return new NextResponse(imageStream, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Length": String(size),
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }
}
