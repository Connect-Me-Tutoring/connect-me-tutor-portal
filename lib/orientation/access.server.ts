import "server-only";

import { createHash } from "node:crypto";

import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";
import { canViewTutorOrientation } from "@/lib/orientation/config.server";

const AUTHORIZATION_CACHE_TTL_MS = 5 * 60 * 1000;
const MAX_AUTHORIZATION_CACHE_ENTRIES = 250;

export type OrientationViewerStatus = "authorized" | "unauthenticated" | "forbidden";

const authorizationCache = new Map<
  string,
  { expiresAt: number; result: Promise<OrientationViewerStatus> }
>();

async function checkViewerStatus(): Promise<OrientationViewerStatus> {
  const user = await cachedGetUser();
  if (!user) return "unauthenticated";

  const profile = await cachedGetProfile(user.id);
  return canViewTutorOrientation(profile?.role) ? "authorized" : "forbidden";
}

export async function getOrientationViewerStatus(
  request: Request,
): Promise<OrientationViewerStatus> {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return checkViewerStatus();

  const cacheKey = createHash("sha256").update(cookieHeader).digest("base64url");
  const now = Date.now();
  const cached = authorizationCache.get(cacheKey);
  if (cached && cached.expiresAt > now) return cached.result;
  if (cached) authorizationCache.delete(cacheKey);

  for (const [key, entry] of authorizationCache) {
    if (entry.expiresAt <= now) authorizationCache.delete(key);
  }
  while (authorizationCache.size >= MAX_AUTHORIZATION_CACHE_ENTRIES) {
    const oldestKey = authorizationCache.keys().next().value;
    if (!oldestKey) break;
    authorizationCache.delete(oldestKey);
  }

  const result = checkViewerStatus();
  authorizationCache.set(cacheKey, {
    expiresAt: now + AUTHORIZATION_CACHE_TTL_MS,
    result,
  });

  try {
    const status = await result;
    if (status !== "authorized" && authorizationCache.get(cacheKey)?.result === result) {
      authorizationCache.delete(cacheKey);
    }
    return status;
  } catch (error) {
    if (authorizationCache.get(cacheKey)?.result === result) {
      authorizationCache.delete(cacheKey);
    }
    throw error;
  }
}
