import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: true,
  getViewerStatus: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mocks.readFile(...args),
}));

vi.mock("@/lib/orientation/access.server", () => ({
  getOrientationViewerStatus: (...args: unknown[]) => mocks.getViewerStatus(...args),
}));

vi.mock("@/lib/orientation/config.server", () => ({
  isTutorOrientationEnabled: () => mocks.enabled,
}));

import { GET } from "./route";

const requestFor = (video: string, headers?: HeadersInit) =>
  new Request(`http://localhost/api/orientation/videos/${video}`, { headers });

const paramsFor = (video: string) => ({ params: Promise.resolve({ video }) });

describe("orientation training video route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.getViewerStatus.mockResolvedValue("authorized");
    mocks.readFile.mockResolvedValue(Buffer.from("0123456789"));
  });

  it("returns 404 before authorization when orientation is disabled", async () => {
    mocks.enabled = false;
    const video = "clip-01-productive-wait-time.mp4";

    const response = await GET(requestFor(video), paramsFor(video));

    expect(response.status).toBe(404);
    expect(mocks.getViewerStatus).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("rejects filenames outside the approved training set", async () => {
    const video = "../private-video.mp4";

    const response = await GET(requestFor("private-video.mp4"), paramsFor(video));

    expect(response.status).toBe(404);
    expect(mocks.getViewerStatus).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("returns 401 to an unauthenticated viewer", async () => {
    mocks.getViewerStatus.mockResolvedValue("unauthenticated");
    const video = "clip-02-check-and-release.mp4";

    const response = await GET(requestFor(video), paramsFor(video));

    expect(response.status).toBe(401);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("returns 403 to a viewer without tutor or admin access", async () => {
    mocks.getViewerStatus.mockResolvedValue("forbidden");
    const video = "clip-03-diagnose-student-thinking.mp4";

    const response = await GET(requestFor(video), paramsFor(video));

    expect(response.status).toBe(403);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("serves a complete video with private cache headers", async () => {
    const video = "clip-04-target-the-misconception.mp4";

    const response = await GET(requestFor(video), paramsFor(video));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("video/mp4");
    expect(response.headers.get("content-length")).toBe("10");
    expect(response.headers.get("accept-ranges")).toBe("bytes");
    await expect(response.text()).resolves.toBe("0123456789");
  });

  it("serves browser byte ranges with a 206 response", async () => {
    const video = "clip-05-use-guided-analogy.mp4";

    const response = await GET(requestFor(video, { range: "bytes=2-5" }), paramsFor(video));

    expect(response.status).toBe(206);
    expect(response.headers.get("content-range")).toBe("bytes 2-5/10");
    expect(response.headers.get("content-length")).toBe("4");
    await expect(response.text()).resolves.toBe("2345");
  });

  it("rejects unsatisfiable byte ranges", async () => {
    const video = "clip-06-turn-near-miss-into-success.mp4";

    const response = await GET(requestFor(video, { range: "bytes=50-60" }), paramsFor(video));

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });

  it("reuses decoded video bytes across requests", async () => {
    const video = "clip-07-normalize-uncertainty.mp4";

    const first = await GET(requestFor(video), paramsFor(video));
    const second = await GET(requestFor(video, { range: "bytes=-3" }), paramsFor(video));

    expect(first.status).toBe(200);
    expect(second.status).toBe(206);
    await expect(second.text()).resolves.toBe("789");
    expect(mocks.readFile).toHaveBeenCalledOnce();
  });
});
