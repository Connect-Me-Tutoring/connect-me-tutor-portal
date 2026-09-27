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

const SIGNED_URL =
  "https://example.supabase.co/storage/v1/object/sign/orientations/slides/x?token=t";

const get = (slide: string) =>
  GET(new Request(`http://localhost/api/orientation/slides/${slide}`), {
    params: Promise.resolve({ slide }),
  });

describe("orientation slide route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getViewerStatus.mockResolvedValue("authorized");
    mocks.createAssetUrl.mockResolvedValue(SIGNED_URL);
  });

  it("rejects invalid slide names before checking access or storage", async () => {
    const response = await get("../not-a-slide.webp");

    expect(response.status).toBe(404);
    expect(mocks.getViewerStatus).not.toHaveBeenCalled();
    expect(mocks.createAssetUrl).not.toHaveBeenCalled();
  });

  it("returns 401 to an unauthenticated viewer", async () => {
    mocks.getViewerStatus.mockResolvedValue("unauthenticated");

    const response = await get("slide-03.webp");

    expect(response.status).toBe(401);
    expect(mocks.createAssetUrl).not.toHaveBeenCalled();
  });

  it("returns 403 to a viewer without orientation access", async () => {
    mocks.getViewerStatus.mockResolvedValue("forbidden");

    const response = await get("slide-04.webp");

    expect(response.status).toBe(403);
    expect(mocks.createAssetUrl).not.toHaveBeenCalled();
  });

  it("redirects authorized viewers to a signed storage URL", async () => {
    const response = await get("slide-05.webp");

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toBe(SIGNED_URL);
    expect(response.headers.get("cache-control")).toBe("private, max-age=1800");
    expect(mocks.createAssetUrl).toHaveBeenCalledWith("slides/slide-05.webp");
  });

  it("returns 404 when storage cannot sign the slide", async () => {
    mocks.createAssetUrl.mockResolvedValue(null);

    const response = await get("slide-21.webp");

    expect(response.status).toBe(404);
  });

  it("rechecks access on every request", async () => {
    mocks.getViewerStatus.mockResolvedValueOnce("authorized").mockResolvedValueOnce("forbidden");

    const first = await get("slide-01.webp");
    const second = await get("slide-02.webp");

    expect([first.status, second.status]).toEqual([302, 403]);
    expect(mocks.createAssetUrl).toHaveBeenCalledOnce();
  });
});
