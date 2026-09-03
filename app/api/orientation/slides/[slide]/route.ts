import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

import { NextResponse } from "next/server";

import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";
import {
  canViewTutorOrientation,
  isTutorOrientationEnabled,
} from "@/lib/orientation/config.server";

export const runtime = "nodejs";

const SLIDE_FILE_PATTERN = /^slide-(0[1-9]|1\d|2[01])\.webp$/;
const AUTHORIZATION_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_AUTHORIZATION_CACHE_ENTRIES = 250;

type ViewerStatus = "authorized" | "unauthenticated" | "forbidden";

const authorizationCache = new Map<string, { expiresAt: number; result: Promise<ViewerStatus> }>();
const slideImageCache = new Map<string, Promise<ArrayBuffer>>();

async function checkViewerStatus(): Promise<ViewerStatus> {
  const user = await cachedGetUser();
  if (!user) return "unauthenticated";

  const profile = await cachedGetProfile(user.id);
  return canViewTutorOrientation(profile?.role) ? "authorized" : "forbidden";
}

async function getViewerStatus(request: Request): Promise<ViewerStatus> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return checkViewerStatus();

  const cacheKey = createHash("sha256").update(cookieHeader).digest("base64url");
  const now = Date.now();
  const cached = authorizationCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.result;
  if (cached) authorizationCache.delete(cacheKey);

  for (const [key, entry] of authorizationCache) {
    if (entry.expiresAt <= now) authorizationCache.delete(key);
  }
  while (authorizationCache.size >= MAX_AUTHORIZATION_CACHE_ENTRIES) {
    const oldestKey = authorizationCache.keys().next().value;
    if (!oldestKey) break;
    authorizationCache.delete(oldestKey);
  }

  const result = checkViewerStatus();
  authorizationCache.set(cacheKey, {
    expiresAt: now + AUTHORIZATION_CACHE_TTL_MS,
    result,
  });

  try {
    const status = await result;
    if (status !== "authorized" && authorizationCache.get(cacheKey)?.result === result) {
      authorizationCache.delete(cacheKey);
    }
    return status;
  } catch (error) {
    if (authorizationCache.get(cacheKey)?.result === result) {
      authorizationCache.delete(cacheKey);
    }
    throw error;
  }
}

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

  const viewerStatus = await getViewerStatus(request);
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
