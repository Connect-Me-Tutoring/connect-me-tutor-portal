import "server-only";

import { cachedGetProfile } from "@/lib/actions/cache";
import { cachedGetUser } from "@/lib/actions/user/actions";
import { canViewTutorOrientation } from "@/lib/orientation/config.server";

export type OrientationViewerStatus = "authorized" | "unauthenticated" | "forbidden";

export async function getOrientationViewerStatus(): Promise<OrientationViewerStatus> {
  const user = await cachedGetUser();
  if (!user) return "unauthenticated";

  const profile = await cachedGetProfile(user.id);
  return canViewTutorOrientation(profile?.role) ? "authorized" : "forbidden";
}
