import { beforeEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getActiveProfile: vi.fn(),
  hasTutorOrientationAccess: vi.fn(),
}));

vi.mock("@/lib/orientation/config.server", () => ({
  hasTutorOrientationAccess: (...args: unknown[]) => mocks.hasTutorOrientationAccess(...args),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: (...args: unknown[]) => mocks.getUser(...args) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: (...args: unknown[]) => mocks.getActiveProfile(...args),
        }),
      }),
    }),
  }),
}));

import { config, proxy } from "./proxy";

const incompleteTutor = {
  email: "tutor@example.com",
  id: "profile-1",
  orientation_completed_at: null,
  role: "Tutor",
};

function authenticateAs(profile: Record<string, unknown>) {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  mocks.getActiveProfile.mockResolvedValue({ data: { profile }, error: null });
}

describe("orientation proxy coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
    mocks.getActiveProfile.mockResolvedValue({ data: null, error: null });
    mocks.hasTutorOrientationAccess.mockResolvedValue(true);
  });

  it("runs session refresh middleware for all orientation pages", () => {
    expect(unstable_doesMiddlewareMatch({ config, url: "http://localhost/orientation" })).toBe(
      true,
    );
    expect(
      unstable_doesMiddlewareMatch({
        config,
        url: "http://localhost/orientation/walkthrough",
      }),
    ).toBe(true);
  });

  it("redirects unauthenticated orientation requests to sign in", async () => {
    const response = await proxy(new NextRequest("http://localhost/orientation/walkthrough"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/");
  });

  it("sends an incomplete tutor directly to orientation after login", async () => {
    authenticateAs(incompleteTutor);

    const response = await proxy(new NextRequest("http://localhost/"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/orientation");
  });

  it("blocks direct portal URLs until a tutor completes orientation", async () => {
    authenticateAs(incompleteTutor);

    const response = await proxy(new NextRequest("http://localhost/dashboard/my-students"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("http://localhost/orientation");
  });

  it("allows incomplete tutors to use orientation pages and assets", async () => {
    authenticateAs(incompleteTutor);

    const pageResponse = await proxy(new NextRequest("http://localhost/orientation/walkthrough"));
    const assetResponse = await proxy(
      new NextRequest("http://localhost/api/orientation/slides/slide-01.webp"),
    );

    expect(pageResponse.status).toBe(200);
    expect(pageResponse.headers.get("location")).toBeNull();
    expect(assetResponse.status).toBe(200);
    expect(assetResponse.headers.get("location")).toBeNull();
  });

  it("rejects non-orientation API requests for incomplete tutors", async () => {
    authenticateAs(incompleteTutor);

    const response = await proxy(new NextRequest("http://localhost/api/ai-chatbot"));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({
      error: "Complete tutor orientation before accessing the portal.",
    });
  });

  it("allows incomplete tutors into the portal when the PostHog flag is disabled", async () => {
    authenticateAs(incompleteTutor);
    mocks.hasTutorOrientationAccess.mockResolvedValue(false);

    const pageResponse = await proxy(new NextRequest("http://localhost/dashboard/my-students"));
    const apiResponse = await proxy(new NextRequest("http://localhost/api/ai-chatbot"));
    const rootResponse = await proxy(new NextRequest("http://localhost/"));

    expect(pageResponse.status).toBe(200);
    expect(pageResponse.headers.get("location")).toBeNull();
    expect(apiResponse.status).toBe(200);
    expect(rootResponse.status).toBe(307);
    expect(rootResponse.headers.get("location")).toBe("http://localhost/dashboard");
  });

  it("allows completed tutors and non-tutors into the portal", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
    mocks.getActiveProfile
      .mockResolvedValueOnce({
        data: {
          profile: {
            role: "Tutor",
            orientation_completed_at: "2026-10-01T12:00:00.000Z",
          },
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { profile: { role: "Student", orientation_completed_at: null } },
        error: null,
      });

    const tutorResponse = await proxy(new NextRequest("http://localhost/dashboard"));
    const studentResponse = await proxy(new NextRequest("http://localhost/dashboard"));

    expect(tutorResponse.status).toBe(200);
    expect(studentResponse.status).toBe(200);
    expect(mocks.hasTutorOrientationAccess).not.toHaveBeenCalled();
  });
});
