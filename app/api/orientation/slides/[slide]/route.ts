import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { getOrientationViewerStatus } from "@/lib/orientation/access.server";
import { isTutorOrientationEnabled } from "@/lib/orientation/config.server";

export const runtime = "nodejs";

const SLIDE_FILE_PATTERN = /^slide-(0[1-9]|1\d|2[01])\.webp$/;
const slideImageCache = new Map<string, Promise<ArrayBuffer>>();

function getSlideImage(slide: string): Promise<ArrayBuffer> {
  const cached = slideImageCache.get(slide);
  if (cached) return cached;

  const slidePath = path.join(process.cwd(), "private", "orientation", "slides", slide);
  const image = readFile(slidePath)
    .then((file) => Uint8Array.from(file).buffer)
    .catch((error) => {
      slideImageCache.delete(slide);
      throw error;
    });
  slideImageCache.set(slide, image);
  return image;
}

export async function GET(request: Request, { params }: { params: Promise<{ slide: string }> }) {
  if (!isTutorOrientationEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { slide } = await params;

  if (!SLIDE_FILE_PATTERN.test(slide)) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }

  const viewerStatus = await getOrientationViewerStatus(request);
  if (viewerStatus === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (viewerStatus === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const image = await getSlideImage(slide);

    return new NextResponse(image, {
      headers: {
        "Cache-Control": "private, max-age=3600",
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }
}
