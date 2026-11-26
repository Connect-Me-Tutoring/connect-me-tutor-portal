import "server-only";

import PostHogClient from "@/lib/posthog";

/** Existing PostHog feature flag used as the tutor-orientation kill switch. */
export const TUTOR_ORIENTATION_FLAG = "tutor-orientation";

/**
 * Env override (`TUTOR_ORIENTATION_ENABLED`, falling back to `ORIENTATION_QUIZ_ENABLED`).
 * When "true", every tutor gets orientation access regardless of the PostHog flag.
 */
export const isTutorOrientationEnabledForAll = () =>
  (process.env.TUTOR_ORIENTATION_ENABLED ?? process.env.ORIENTATION_QUIZ_ENABLED)?.trim() ===
  "true";

export const canViewTutorOrientation = (role: string | null | undefined) =>
  role === "Tutor" || role === "Admin";

type OrientationProfile = {
  id?: string | null;
  email?: string | null;
  role?: string | null;
};

/**
 * Whether this profile can open the tutor orientation.
 * Admins retain preview access. Tutors get access when the env override is "true";
 * otherwise access follows PostHog, with failures treated as disabled.
 */
export async function hasTutorOrientationAccess(
  profile: OrientationProfile | null | undefined,
): Promise<boolean> {
  if (!profile || !canViewTutorOrientation(profile.role)) return false;
  if (profile.role === "Admin") return true;
  if (isTutorOrientationEnabledForAll()) return true;
  if (!profile.id) return false;

  const client = PostHogClient();
  if (!client) return false;

  try {
    const flags = await client.evaluateFlags(profile.id, {
      flagKeys: [TUTOR_ORIENTATION_FLAG],
      personProperties: {
        ...(profile.email ? { email: profile.email } : {}),
        role: "Tutor",
      },
    });

    return flags.isEnabled(TUTOR_ORIENTATION_FLAG);
  } catch (error) {
    console.error("Failed to evaluate tutor orientation flag:", error);
    return false;
  }
}
