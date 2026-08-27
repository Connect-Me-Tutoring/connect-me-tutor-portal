/**
 * Fixed-window rate limiter. Server-side only.
 *
 * Ported from `dataPortalWebsite/frontend/src/lib/data-analysis/rate-limit.ts`.
 *
 * IMPORTANT: state is held in the memory of a single server instance, so on a
 * serverless deployment each instance keeps its own counters and the effective
 * limit multiplies by the instance count. That is acceptable here because this
 * is the cheap first line only — the analysis service enforces the real,
 * shared per-user ceiling in Postgres before touching data.
 */

if (typeof window !== "undefined") {
  throw new Error("data-portal rate limiter was imported into a client bundle.");
}

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

/**
 * Upper bound on tracked keys. Without this, an attacker cycling identifiers
 * would grow the map until the process runs out of memory — the rate limiter
 * itself would become the denial-of-service vector.
 */
const MAX_TRACKED_KEYS = 10_000;

let lastSweep = 0;
const SWEEP_INTERVAL_MS = 60_000;

function sweep(now: number) {
  if (now - lastSweep < SWEEP_INTERVAL_MS) return;
  lastSweep = now;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
};

export function checkRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const { limit, windowMs } = options;
  const now = Date.now();

  sweep(now);

  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    if (buckets.size >= MAX_TRACKED_KEYS && !existing) {
      // At capacity with an unknown key: refuse rather than evict a legitimate
      // caller's counter, which is exactly what an attacker would want.
      return {
        allowed: false,
        limit,
        remaining: 0,
        retryAfterSeconds: Math.ceil(windowMs / 1000),
      };
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, limit, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  if (existing.count >= limit) {
    return { allowed: false, limit, remaining: 0, retryAfterSeconds };
  }

  existing.count += 1;
  return { allowed: true, limit, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/** Test helper. Not used by request handling. */
export function resetRateLimits() {
  buckets.clear();
  lastSweep = 0;
}
