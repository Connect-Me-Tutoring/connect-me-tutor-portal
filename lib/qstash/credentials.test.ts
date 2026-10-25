import { describe, expect, it } from "vitest";
import { resolveQstashCredentials } from "./credentials";

const both = {
  EU_CENTRAL_1_QSTASH_TOKEN: "eu-token",
  EU_CENTRAL_1_QSTASH_URL: "https://qstash-eu-central-1.upstash.io",
  US_EAST_1_QSTASH_TOKEN: "us-token",
  US_EAST_1_QSTASH_URL: "https://qstash-us-east-1.upstash.io",
};

describe("resolveQstashCredentials", () => {
  it("uses the US token with the US URL", () => {
    expect(resolveQstashCredentials(both)).toEqual({
      token: "us-token",
      baseUrl: "https://qstash-us-east-1.upstash.io",
    });
  });

  it("stays on US whatever QSTASH_REGION says", () => {
    expect(resolveQstashCredentials({ ...both, QSTASH_REGION: "EU_CENTRAL_1" }).token).toBe(
      "us-token",
    );
  });

  it("falls back to the US endpoint when US_EAST_1_QSTASH_URL is unset", () => {
    expect(resolveQstashCredentials({ US_EAST_1_QSTASH_TOKEN: "us-token" }).baseUrl).toBe(
      "https://qstash-us-east-1.upstash.io",
    );
  });

  it("throws when the US token is missing instead of using another region", () => {
    expect(() => resolveQstashCredentials({ EU_CENTRAL_1_QSTASH_TOKEN: "eu-token" })).toThrow(
      "US_EAST_1_QSTASH_TOKEN is not set",
    );
  });
});
