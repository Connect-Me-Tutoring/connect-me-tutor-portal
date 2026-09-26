import "server-only";

import { logError } from "@/lib/posthog";
import { createAdminClient } from "@/lib/supabase/server";

/** Private bucket holding orientation media under `slides/` and `videos/`. */
export const ORIENTATION_BUCKET = "orientations";

const SIGNED_URL_TTL_SECONDS = 60 * 60;

/** Browsers may reuse the redirect well before the signed URL expires. */
export const ORIENTATION_REDIRECT_CACHE_CONTROL = "private, max-age=1800";

/**
 * Creates a short-lived signed URL for an orientation asset. The bucket has no
 * storage policies, so the service role is required; callers must check access first.
 */
export async function createOrientationAssetUrl(objectPath: string): Promise<string | null> {
  const supabase = await createAdminClient();
  const { data, error } = await supabase.storage
    .from(ORIENTATION_BUCKET)
    .createSignedUrl(objectPath, SIGNED_URL_TTL_SECONDS);

  if (error || !data?.signedUrl) {
    await logError(error ?? new Error("No signed URL returned"), { objectPath }, "orientation_asset_error");
    return null;
  }

  return data.signedUrl;
}
