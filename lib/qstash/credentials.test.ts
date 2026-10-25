import { describe, expect, it } from "vitest";
import { resolveQstashCredentials } from "./credentials";

const both = {
  EU_CENTRAL_1_QSTASH_TOKEN: "eu-token",
  EU_CENTRAL_1_QSTASH_URL: "https://qstash-eu-central-1.upstash.io",
  US_EAST_1_QSTASH_TOKEN: "us-token",
  US_EAST_1_QSTASH_URL: "https://qstash-us-east-1.upstash.io",
};

describe("resolveQstashCredentials", () => {
  it("defaults to the EU token and URL when QSTASH_REGION is unset", () => {
    expect(resolveQstashCredentials(both)).toEqual({
      region: "EU_CENTRAL_1",
      token: "eu-token",
      baseUrl: "https://qstash-eu-central-1.upstash.io",
    });
  });

  it("never pairs the US token with the EU URL", () => {
    const creds = resolveQstashCredentials({ ...both, QSTASH_REGION: "US_EAST_1" });
    expect(creds.token).toBe("us-token");
    expect(creds.baseUrl).toBe("https://qstash-us-east-1.upstash.io");
  });

  it("accepts the hyphenated region spelling", () => {
    expect(resolveQstashCredentials({ ...both, QSTASH_REGION: "us-east-1" }).region).toBe(
      "US_EAST_1",
    );
  });

  it("falls back to the region's default URL when <REGION>_QSTASH_URL is unset", () => {
    expect(resolveQstashCredentials({ EU_CENTRAL_1_QSTASH_TOKEN: "eu-token" }).baseUrl).toBe(
      "https://qstash.upstash.io",
    );
    expect(
      resolveQstashCredentials({ QSTASH_REGION: "US_EAST_1", US_EAST_1_QSTASH_TOKEN: "us-token" })
        .baseUrl,
    ).toBe("https://qstash-us-east-1.upstash.io");
  });

  it("throws when the selected region has no token", () => {
    expect(() => resolveQstashCredentials({ US_EAST_1_QSTASH_TOKEN: "us-token" })).toThrow(
      "EU_CENTRAL_1_QSTASH_TOKEN is not set",
    );
  });

  it("throws on an unknown region instead of guessing", () => {
    expect(() => resolveQstashCredentials({ ...both, QSTASH_REGION: "AP_SOUTH_1" })).toThrow(
      /QSTASH_REGION/,
    );
  });
});
