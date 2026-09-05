/**
 * QStash and other server-to-server admin callers authenticate with BEARER_TOKEN
 * rather than CRON_SECRET (which Vercel's own cron invoker sends). proxy.ts must
 * recognize this too, or it 401s these requests before the route's own
 * isAuthorized() check ever runs.
 */
export function isBearerTokenAuthorized(request: Request): boolean {
  const secret = process.env.BEARER_TOKEN;
  const authHeader = request.headers.get("authorization");

  if (!secret || !authHeader?.startsWith("Bearer ")) {
    return false;
  }

  return authHeader.slice("Bearer ".length) === secret;
}
