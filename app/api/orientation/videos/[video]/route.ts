import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { ORIENTATION_TRAINING_VIDEO_FILES } from "@/constants/orientation-training-clips";
import { getOrientationViewerStatus } from "@/lib/orientation/access.server";
import { isTutorOrientationEnabled } from "@/lib/orientation/config.server";

export const runtime = "nodejs";

const allowedVideoFiles = new Set<string>(ORIENTATION_TRAINING_VIDEO_FILES);
const videoCache = new Map<string, Promise<ArrayBuffer>>();

function getVideo(video: string): Promise<ArrayBuffer> {
  const cached = videoCache.get(video);
  if (cached) return cached;

  const videoPath = path.join(process.cwd(), "private", "orientation", "videos", video);
  const file = readFile(videoPath)
    .then((contents) => Uint8Array.from(contents).buffer)
    .catch((error) => {
      videoCache.delete(video);
      throw error;
    });

  videoCache.set(video, file);
  return file;
}

function parseRangeHeader(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2])) return null;

  if (!match[1]) {
    const suffixLength = Number(match[2]);
    if (!Number.isSafeInteger(suffixLength) || suffixLength <= 0) return null;
    return { start: Math.max(0, size - suffixLength), end: size - 1 };
  }

  const start = Number(match[1]);
  const requestedEnd = match[2] ? Number(match[2]) : size - 1;
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(requestedEnd) ||
    start < 0 ||
    start >= size ||
    requestedEnd < start
  ) {
    return null;
  }

  return { start, end: Math.min(requestedEnd, size - 1) };
}

function videoHeaders(contentLength: number) {
  return {
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "Content-Length": String(contentLength),
    "Content-Type": "video/mp4",
    "X-Content-Type-Options": "nosniff",
  };
}

export async function GET(request: Request, { params }: { params: Promise<{ video: string }> }) {
  if (!isTutorOrientationEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { video } = await params;
  if (!allowedVideoFiles.has(video)) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  const viewerStatus = await getOrientationViewerStatus(request);
  if (viewerStatus === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (viewerStatus === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const file = await getVideo(video);
    const rangeHeader = request.headers.get("range");

    if (!rangeHeader) {
      return new NextResponse(file, { headers: videoHeaders(file.byteLength) });
    }

    const range = parseRangeHeader(rangeHeader, file.byteLength);
    if (!range) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${file.byteLength}`,
        },
      });
    }

    const body = file.slice(range.start, range.end + 1);
    return new NextResponse(body, {
      status: 206,
      headers: {
        ...videoHeaders(body.byteLength),
        "Content-Range": `bytes ${range.start}-${range.end}/${file.byteLength}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
}
