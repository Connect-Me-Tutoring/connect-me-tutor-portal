import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

import { NextResponse } from "next/server";

import { ORIENTATION_TRAINING_VIDEO_FILES } from "@/constants/orientation-training-clips";
import { getOrientationViewerStatus } from "@/lib/orientation/access.server";
import { isTutorOrientationEnabled } from "@/lib/orientation/config.server";

export const runtime = "nodejs";

const allowedVideoFiles = new Set<string>(ORIENTATION_TRAINING_VIDEO_FILES);

function parseRangeHeader(rangeHeader: string, size: number) {
  const match = /^bytes=(\d*)-(\d*)$/.exec(rangeHeader.trim());
  if (!match || (!match[1] && !match[2]) || size <= 0) return null;

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

function streamVideo(videoPath: string, range?: { start: number; end: number }) {
  const stream = range ? createReadStream(videoPath, range) : createReadStream(videoPath);
  return Readable.toWeb(stream) as ReadableStream<Uint8Array>;
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

  const viewerStatus = await getOrientationViewerStatus();
  if (viewerStatus === "unauthenticated") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (viewerStatus === "forbidden") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  try {
    const videoPath = path.join(process.cwd(), "private", "orientation", "videos", video);
    const { size } = await stat(videoPath);
    const rangeHeader = request.headers.get("range");

    if (!rangeHeader) {
      return new NextResponse(streamVideo(videoPath), { headers: videoHeaders(size) });
    }

    const range = parseRangeHeader(rangeHeader, size);
    if (!range) {
      return new NextResponse(null, {
        status: 416,
        headers: {
          "Accept-Ranges": "bytes",
          "Content-Range": `bytes */${size}`,
        },
      });
    }

    const contentLength = range.end - range.start + 1;
    return new NextResponse(streamVideo(videoPath, range), {
      status: 206,
      headers: {
        ...videoHeaders(contentLength),
        "Content-Range": `bytes ${range.start}-${range.end}/${size}`,
      },
    });
  } catch {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }
}
