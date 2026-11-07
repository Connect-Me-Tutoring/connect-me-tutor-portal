import { describe, expect, it, beforeEach, vi, afterEach } from "vitest";
import { rateLimit, __resetRateLimits } from "./rate-limit";

describe("rateLimit", () => {
  beforeEach(() => {
    __resetRateLimits();
    vi.useFakeTimers();
  });
  afterEach(() => vi.useRealTimers());

  it("allows up to the limit and then refuses", () => {
    for (let i = 0; i < 3; i++) {
      expect(rateLimit("a", 3, 1000).allowed).toBe(true);
    }
    const refused = rateLimit("a", 3, 1000);
    expect(refused.allowed).toBe(false);
    expect(refused.remaining).toBe(0);
    expect(refused.retryAfterSeconds).toBeGreaterThan(0);
  });

  it("counts each caller separately", () => {
    rateLimit("a", 1, 1000);
    expect(rateLimit("a", 1, 1000).allowed).toBe(false);
    expect(rateLimit("b", 1, 1000).allowed).toBe(true);
  });

  it("lets the caller through again once the window passes", () => {
    rateLimit("a", 1, 1000);
    expect(rateLimit("a", 1, 1000).allowed).toBe(false);
    vi.advanceTimersByTime(1001);
    expect(rateLimit("a", 1, 1000).allowed).toBe(true);
  });

  it("reports how many requests are left", () => {
    expect(rateLimit("a", 3, 1000).remaining).toBe(2);
    expect(rateLimit("a", 3, 1000).remaining).toBe(1);
    expect(rateLimit("a", 3, 1000).remaining).toBe(0);
  });
});
