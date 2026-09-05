import { beforeEach, describe, expect, it, vi } from "vitest";
import { unstable_doesMiddlewareMatch } from "next/experimental/testing/server";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: () => ({
    auth: { getUser: (...args: unknown[]) => mocks.getUser(...args) },
  }),
}));

import { config, proxy } from "./proxy";

describe("orientation proxy coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: null } });
  });

  it("runs session refresh middleware for all orientation pages", () => {
    expect(config.matcher).toContain("/orientation/:path*");
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
});
