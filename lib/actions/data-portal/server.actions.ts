"use server";

import { requireAdmin } from "../auth/authz.server";
import { createClient } from "@/lib/supabase/server";
import {
  dateRangeSchema,
  mapOverviewToSections,
  overviewPayloadSchema,
  type OverviewSection,
} from "@/lib/data-portal/overview";

/**
 * Loads everything the data portal panel shows, in one database call.
 *
 * Two independent admin checks run on every load: `requireAdmin()` here (the
 * codebase's usual gate, so this action reads like every other admin action)
 * and the one inside `public.data_portal_overview()` itself, which is the
 * authoritative one — it decides from `auth.uid()` on the caller's own
 * session, so even a path that skipped this action could not read anything.
 *
 * The payload is validated strictly before anything is mapped for rendering;
 * a response that does not match the contract exactly is an error, never a
 * partial render. Error messages returned to the client are generic on
 * purpose — detail goes to the server log.
 */

export type OverviewOutcome =
  | { ok: true; generatedAt: string; sections: OverviewSection[] }
  | { ok: false; error: string };

export const getDataPortalOverview = async (dateRange: string): Promise<OverviewOutcome> => {
  try {
    await requireAdmin();
  } catch {
    return { ok: false, error: "This panel is limited to administrators." };
  }

  const parsedRange = dateRangeSchema.safeParse(dateRange);
  if (!parsedRange.success) {
    return { ok: false, error: "Unknown date range." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("data_portal_overview", {
    p_date_range: parsedRange.data,
  });

  if (error) {
    // The function's own admin gate raises "Admin access required"; any other
    // failure is operational. Neither detail belongs in the panel.
    const denied = error.message.includes("Admin access required");
    if (!denied) {
      console.error("[data-portal] Overview call failed.", { message: error.message });
    }
    return {
      ok: false,
      error: denied
        ? "This panel is limited to administrators."
        : "The overview could not be loaded. Try again in a moment.",
    };
  }

  const payload = overviewPayloadSchema.safeParse(data);
  if (!payload.success) {
    console.error("[data-portal] Overview payload failed validation.", {
      issues: payload.error.issues.map((issue) => issue.path.join(".")),
    });
    return { ok: false, error: "The overview could not be loaded. Try again in a moment." };
  }

  return {
    ok: true,
    generatedAt: payload.data.generatedAt,
    sections: mapOverviewToSections(payload.data),
  };
};
