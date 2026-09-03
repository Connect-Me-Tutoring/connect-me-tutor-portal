import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  enabled: true,
  getProfile: vi.fn(),
  getUser: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: (...args: unknown[]) => mocks.readFile(...args),
}));

vi.mock("@/lib/actions/cache", () => ({
  cachedGetProfile: (...args: unknown[]) => mocks.getProfile(...args),
}));

vi.mock("@/lib/actions/user/actions", () => ({
  cachedGetUser: (...args: unknown[]) => mocks.getUser(...args),
}));

vi.mock("@/lib/orientation/config.server", () => ({
  canViewTutorOrientation: (role: string | null | undefined) =>
    role === "Tutor" || role === "Admin",
  isTutorOrientationEnabled: () => mocks.enabled,
}));

import { GET } from "./route";

describe("orientation slide route caching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.enabled = true;
    mocks.getUser.mockResolvedValue({ id: "user-1" });
    mocks.getProfile.mockResolvedValue({ role: "Tutor" });
    mocks.readFile.mockResolvedValue(Buffer.from("slide image"));
  });

  it("returns 404 without authenticating when orientation is disabled", async () => {
    mocks.enabled = false;

    const response = await GET(
      new Request("http://localhost/api/orientation/slides/slide-01.webp"),
      { params: Promise.resolve({ slide: "slide-01.webp" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("rejects invalid slide names before authenticating or reading the filesystem", async () => {
    const response = await GET(
      new Request("http://localhost/api/orientation/slides/not-a-slide.webp"),
      { params: Promise.resolve({ slide: "../not-a-slide.webp" }) },
    );

    expect(response.status).toBe(404);
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("returns 401 to an unauthenticated viewer", async () => {
    mocks.getUser.mockResolvedValue(null);

    const response = await GET(
      new Request("http://localhost/api/orientation/slides/slide-03.webp"),
      { params: Promise.resolve({ slide: "slide-03.webp" }) },
    );

    expect(response.status).toBe(401);
    expect(mocks.getProfile).not.toHaveBeenCalled();
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("returns 403 to a viewer without a tutor or admin profile", async () => {
    mocks.getProfile.mockResolvedValue({ role: "Student" });

    const response = await GET(
      new Request("http://localhost/api/orientation/slides/slide-04.webp", {
        headers: { cookie: "sb-session=student-session" },
      }),
      { params: Promise.resolve({ slide: "slide-04.webp" }) },
    );

    expect(response.status).toBe(403);
    expect(mocks.readFile).not.toHaveBeenCalled();
  });

  it("serves valid slides with private image caching headers", async () => {
    const response = await GET(
      new Request("http://localhost/api/orientation/slides/slide-05.webp", {
        headers: { cookie: "sb-session=tutor-session" },
      }),
      { params: Promise.resolve({ slide: "slide-05.webp" }) },
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("image/webp");
    expect(response.headers.get("cache-control")).toBe("private, max-age=3600");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  });

  it("reuses authorization and decoded slide bytes across requests in one session", async () => {
    const request = () =>
      new Request("http://localhost/api/orientation/slides/slide.webp", {
        headers: { cookie: "sb-session=same-browser-session" },
      });

    const firstResponse = await GET(request(), {
      params: Promise.resolve({ slide: "slide-01.webp" }),
    });
    const secondResponse = await GET(request(), {
      params: Promise.resolve({ slide: "slide-02.webp" }),
    });
    const repeatedResponse = await GET(request(), {
      params: Promise.resolve({ slide: "slide-01.webp" }),
    });

    expect([firstResponse.status, secondResponse.status, repeatedResponse.status]).toEqual([
      200, 200, 200,
    ]);
    await expect(firstResponse.text()).resolves.toBe("slide image");
    await expect(secondResponse.text()).resolves.toBe("slide image");
    await expect(repeatedResponse.text()).resolves.toBe("slide image");
    expect(mocks.getUser).toHaveBeenCalledOnce();
    expect(mocks.getProfile).toHaveBeenCalledOnce();
    expect(mocks.readFile).toHaveBeenCalledTimes(2);
  });
});
