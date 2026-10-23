import "server-only";

import PostHogClient from "@/lib/posthog";

/** Existing PostHog feature flag used as the tutor-orientation kill switch. */
export const TUTOR_ORIENTATION_FLAG = "tutor-orientation";

// Orientation must never make the portal unavailable when PostHog is slow or
// unreachable. The SDK's default request timeout is 10 seconds, which is too
// long for a check made while routing a request.
export const TUTOR_ORIENTATION_FLAG_TIMEOUT_MS = 1_500;

export const canViewTutorOrientation = (role: string | null | undefined) =>
  role === "Tutor" || role === "Admin";

type OrientationProfile = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

/**
 * Whether this profile can open the tutor orientation.
 * Admins retain preview access. Tutor access and enforcement follow PostHog, with
 * failures treated as disabled so the flag remains a safe emergency kill switch.
 */
export async function hasTutorOrientationAccess(
  profile: OrientationProfile | null | undefined,
): Promise<boolean> {
  if (!profile || !canViewTutorOrientation(profile.role)) return false;
  if (profile.role === "Admin") return true;
  if (!profile.id) return false;

  const client = PostHogClient();
  if (!client) return false;

  let timeout: ReturnType<typeof setTimeout> | undefined;

  try {
    const flags = await Promise.race([
      client.evaluateFlags(profile.id, {
        flagKeys: [TUTOR_ORIENTATION_FLAG],
        personProperties: {
          ...(profile.email ? { email: profile.email } : {}),
          role: "Tutor",
        },
      }),
      new Promise<null>((resolve) => {
        timeout = setTimeout(() => resolve(null), TUTOR_ORIENTATION_FLAG_TIMEOUT_MS);
      }),
    ]);

    if (!flags) {
      console.error("Tutor orientation flag evaluation timed out; leaving portal access open.");
      return false;
    }

    return flags.isEnabled(TUTOR_ORIENTATION_FLAG);
  } catch (error) {
    console.error("Failed to evaluate tutor orientation flag:", error);
    return false;
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}
