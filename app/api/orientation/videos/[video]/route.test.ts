import { beforeEach, describe, expect, it, vi } from "vitest";
import { Readable } from "node:stream";

const mocks = vi.hoisted(() => ({
  createReadStream: vi.fn(),
  enabled: true,
  getViewerStatus: vi.fn(),
  stat: vi.fn(),
}));

vi.mock("node:fs", () => ({
  createReadStream: (...args: unknown[]) => mocks.createReadStream(...args),
}));

vi.mock("node:fs/promises", () => ({
  stat: (...args: unknown[]) => mocks.stat(...args),
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
    mocks.stat.mockResolvedValue({ size: 10 });
    mocks.createReadStream.mockImplementation(
      (_path: string, range?: { start?: number; end?: number }) => {
        const file = Buffer.from("0123456789");
        const start = range?.start ?? 0;
        const end = range?.end ?? file.length - 1;
        return Readable.from([file.subarray(start, end + 1)]);
      },
    );
  });

  it("returns 404 before authorization when orientation is disabled", async () => {
    mocks.enabled = false;
    const video = "clip-01-productive-wait-time.mp4";

    const response = await GET(requestFor(video), paramsFor(video));

    expect(response.status).toBe(404);
    expect(mocks.getViewerStatus).not.toHaveBeenCalled();
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.createReadStream).not.toHaveBeenCalled();
  });

  it("rejects filenames outside the approved training set", async () => {
    const video = "../private-video.mp4";

    const response = await GET(requestFor("private-video.mp4"), paramsFor(video));

    expect(response.status).toBe(404);
    expect(mocks.getViewerStatus).not.toHaveBeenCalled();
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.createReadStream).not.toHaveBeenCalled();
  });

  it("returns 401 to an unauthenticated viewer", async () => {
    mocks.getViewerStatus.mockResolvedValue("unauthenticated");
    const video = "clip-02-check-and-release.mp4";

    const response = await GET(requestFor(video), paramsFor(video));

    expect(response.status).toBe(401);
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.createReadStream).not.toHaveBeenCalled();
  });

  it("returns 403 to a viewer without tutor or admin access", async () => {
    mocks.getViewerStatus.mockResolvedValue("forbidden");
    const video = "clip-03-diagnose-student-thinking.mp4";

    const response = await GET(requestFor(video), paramsFor(video));

    expect(response.status).toBe(403);
    expect(mocks.stat).not.toHaveBeenCalled();
    expect(mocks.createReadStream).not.toHaveBeenCalled();
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
    expect(mocks.createReadStream).toHaveBeenCalledWith(expect.any(String), {
      start: 2,
      end: 5,
    });
  });

  it("rejects unsatisfiable byte ranges", async () => {
    const video = "clip-06-turn-near-miss-into-success.mp4";

    const response = await GET(requestFor(video, { range: "bytes=50-60" }), paramsFor(video));

    expect(response.status).toBe(416);
    expect(response.headers.get("content-range")).toBe("bytes */10");
  });

  it("streams each request without retaining the video in process memory", async () => {
    const video = "clip-07-normalize-uncertainty.mp4";

    const first = await GET(requestFor(video), paramsFor(video));
    const second = await GET(requestFor(video, { range: "bytes=-3" }), paramsFor(video));

    expect(first.status).toBe(200);
    expect(second.status).toBe(206);
    await expect(second.text()).resolves.toBe("789");
    expect(mocks.stat).toHaveBeenCalledTimes(2);
    expect(mocks.createReadStream).toHaveBeenCalledTimes(2);
  });
});
