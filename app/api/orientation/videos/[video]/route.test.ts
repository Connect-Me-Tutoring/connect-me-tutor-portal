import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  createAssetUrl: vi.fn(),
  getViewerStatus: vi.fn(),
}));

vi.mock("@/lib/orientation/access.server", () => ({
  getOrientationViewerStatus: (...args: unknown[]) => mocks.getViewerStatus(...args),
}));

vi.mock("@/lib/orientation/storage.server", () => ({
  createOrientationAssetUrl: (...args: unknown[]) => mocks.createAssetUrl(...args),
  ORIENTATION_REDIRECT_CACHE_CONTROL: "private, max-age=1800",
}));

import { GET } from "./route";

const SIGNED_URL = "https://example.supabase.co/storage/v1/object/sign/orientations/videos/x?token=t";

const get = (video: string) =>
  GET(new Request(`http://localhost/api/orientation/videos/${video}`), {
    params: Promise.resolve({ video }),
  });

describe("orientation training video route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerStatus.mockResolvedValue("authorized");
    mocks.createAssetUrl.mockResolvedValue(SIGNED_URL);
  });

  it("rejects filenames outside the approved training set", async () => {
    const response = await get("../private-video.mp4");

    expect(response.status).toBe(404);
    expect(mocks.getViewerStatus).not.toHaveBeenCalled();
    expect(mocks.createAssetUrl).not.toHaveBeenCalled();
  });

  it("returns 401 to an unauthenticated viewer", async () => {
    mocks.getViewerStatus.mockResolvedValue("unauthenticated");

    const response = await get("clip-02-check-and-release.mp4");

    expect(response.status).toBe(401);
    expect(mocks.createAssetUrl).not.toHaveBeenCalled();
  });

  it("returns 403 to a viewer without orientation access", async () => {
    mocks.getViewerStatus.mockResolvedValue("forbidden");

    const response = await get("clip-03-diagnose-student-thinking.mp4");

    expect(response.status).toBe(403);
    expect(mocks.createAssetUrl).not.toHaveBeenCalled();
  });

  it("redirects authorized viewers to a signed storage URL", async () => {
    const response = await get("clip-04-target-the-misconception.mp4");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(SIGNED_URL);
    expect(response.headers.get("cache-control")).toBe("private, max-age=1800");
    expect(mocks.createAssetUrl).toHaveBeenCalledWith(
      "videos/clip-04-target-the-misconception.mp4",
    );
  });

  it("returns 404 when storage cannot sign the video", async () => {
    mocks.createAssetUrl.mockResolvedValue(null);

    const response = await get("clip-08-plan-follow-up.mp4");

    expect(response.status).toBe(404);
  });
});
