import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/actions/auth/authz.server";
import { DataPortalPage } from "@/components/admin/data-portal/data-portal-page";

export const metadata = {
  title: "Data Portal | Connect Me",
};

/**
 * /dashboard/data-portal — the admin nav's Data Portal destination.
 *
 * Gated twice: here, server-side, before anything renders — and again inside
 * public.data_portal_overview() itself, which decides from auth.uid() on the
 * caller's own session. The nav item being admin-only is presentation, not
 * enforcement.
 */
export default async function Page() {
  try {
    await requireAdmin();
  } catch {
    redirect("/dashboard");
  }

  return <DataPortalPage />;
}
