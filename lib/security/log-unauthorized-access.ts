import { logEvent } from "@/lib/posthog";

/**
 * Best-effort client IP from proxy headers (Vercel/most CDNs set x-forwarded-for).
 * Not authoritative — spoofable by the client — used for observability, not auth decisions.
 */
export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0].trim();

  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;

  return "unknown";
}

/**
 * Logs a failed authorization attempt (bad/missing bearer token, cron secret, etc.)
 * so repeated hits from the same IP are visible in PostHog instead of silently 401ing.
 */
export async function logUnauthorizedAccess(request: Request, route: string) {
  const ip = getClientIp(request);
  await logEvent(
    "unauthorized_access_attempt",
    {
      route,
      method: request.method,
      ip,
    },
    ip,
  );
}
