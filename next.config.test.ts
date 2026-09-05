import { afterEach, describe, expect, it, vi } from "vitest";

import nextConfig from "./next.config.mjs";

async function getContentSecurityPolicy() {
  if (!nextConfig.headers) {
    throw new Error("Expected Next.js headers configuration");
  }

  const headerRules = await nextConfig.headers();
  const policy = headerRules
    .flatMap((rule) => rule.headers)
    .find((header) => header.key === "Content-Security-Policy")?.value;

  expect(policy).toBeDefined();
  return policy;
}

describe("Content Security Policy", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("allows React development debugging", async () => {
    vi.stubEnv("NODE_ENV", "development");

    expect(await getContentSecurityPolicy()).toContain("'unsafe-eval'");
  });

  it("keeps unsafe eval disabled in production", async () => {
    vi.stubEnv("NODE_ENV", "production");

    expect(await getContentSecurityPolicy()).not.toContain("'unsafe-eval'");
  });
});
