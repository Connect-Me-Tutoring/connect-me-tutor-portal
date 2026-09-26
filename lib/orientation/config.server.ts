import "server-only";

import { cache } from "react";

import PostHogClient from "@/lib/posthog";
import type { Profile } from "@/types";

/** PostHog feature flag controlling which tutors get the orientation. */
export const TUTOR_ORIENTATION_FLAG = "tutor-orientation";

export const canViewTutorOrientation = (role: string | null | undefined) =>
  role === "Tutor" || role === "Admin";

// Deduped per request so the layout, page, and nav share one PostHog call.
const isTutorInOrientationRollout = cache(
  async (profileId: string, email: string | null | undefined): Promise<boolean> => {
    const client = PostHogClient();
    if (!client) return false;

    try {
      // Person properties are sent inline so the flag can target by email
      // without the user having been identified in PostHog first.
      const enabled = await client.isFeatureEnabled(TUTOR_ORIENTATION_FLAG, profileId, {
        personProperties: { ...(email ? { email } : {}), role: "Tutor" },
      });
      return enabled === true;
    } catch (error) {
      console.error("Failed to evaluate tutor orientation flag:", error);
      return false;
    }
  },
);

/**
 * Whether this profile should see (and be gated by) the tutor orientation.
 * Admins always have access for previewing; tutors must be in the PostHog rollout.
 * Fails closed: if PostHog is unavailable, tutors are not gated.
 */
export async function hasTutorOrientationAccess(
  profile: Pick<Profile, "id" | "role" | "email"> | null | undefined,
): Promise<boolean> {
  if (!profile || !canViewTutorOrientation(profile.role)) return false;
  if (profile.role === "Admin") return true;

  return isTutorInOrientationRollout(profile.id, profile.email);
}
