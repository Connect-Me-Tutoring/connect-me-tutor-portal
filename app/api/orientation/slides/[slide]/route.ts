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

export async function GET(_request: Request, { params }: { params: Promise<{ slide: string }> }) {
  if (!isTutorOrientationEnabled()) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const user = await cachedGetUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const profile = await cachedGetProfile(user.id);
  if (!canViewTutorOrientation(profile?.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slide } = await params;

  if (!SLIDE_FILE_PATTERN.test(slide)) {
    return NextResponse.json({ error: "Slide not found" }, { status: 404 });
  }

  const slidePath = path.join(process.cwd(), "private", "orientation", "slides", slide);

  try {
    const image = await readFile(slidePath);

    return new NextResponse(new Uint8Array(image), {
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
