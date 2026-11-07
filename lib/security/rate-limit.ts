import "server-only";

/**
 * A fixed-window rate limiter held in process memory.
 *
 * Deliberately small. It is here to stop one admin's chat window from running
 * up a model bill or hammering the database, not to survive a determined
 * attacker: the callers are already past requireAdmin(), so the threat is cost
 * and accident rather than abuse.
 *
 * Because the counters live in memory, each server instance keeps its own. On
 * a single long-lived server that is the whole story; spread across several
 * instances the effective allowance is the limit times the instance count. Move
 * the counters to Redis or Postgres before relying on this as a spend control.
 */

type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

// Without this the map grows one entry per caller, forever.
const SWEEP_AFTER = 10_000;
let writesSinceSweep = 0;

function sweep(now: number) {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type RateLimitResult = {
  allowed: boolean;
  /** Requests left in this window, after counting the current one. */
  remaining: number;
  /** Whole seconds until the window resets. Zero when allowed. */
  retryAfterSeconds: number;
};

export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now();

  if (++writesSinceSweep >= SWEEP_AFTER) {
    writesSinceSweep = 0;
    sweep(now);
  }

  const existing = windows.get(key);

  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
  }

  if (existing.count >= limit) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((existing.resetAt - now) / 1000)),
    };
  }

  existing.count += 1;
  return { allowed: true, remaining: limit - existing.count, retryAfterSeconds: 0 };
}

/** Test seam. Never call this from application code. */
export function __resetRateLimits() {
  windows.clear();
  writesSinceSweep = 0;
}
