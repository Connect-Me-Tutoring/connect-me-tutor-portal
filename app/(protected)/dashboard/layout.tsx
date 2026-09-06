import { cachedGetUser } from "@/lib/actions/user/actions";
import DashboardLayout from "@/components/dashboard/dashboard-layout";
import DashboardProviders from "./dashboardprovider";
import { getUserProfiles } from "@/lib/actions/profile/server.actions";
import { cachedGetProfile } from "@/lib/actions/cache";
import { isTutorOrientationEnabled } from "@/lib/orientation/config.server";
import { redirect } from "next/navigation";
import { logError } from "@/lib/posthog";

export const dynamic = "force-dynamic";

export default async function Layout({ children }: { children: React.ReactNode }) {
  const user = await cachedGetUser().catch(async (error) => {
    console.error("Unable to get user session", error);
    await logError(error, {}, "dashboard_layout_error");
    redirect("/");
  });

  if (!user) redirect("/");

  const profile = await cachedGetProfile(user.id);

  const orientationEnabled = isTutorOrientationEnabled();
  if (orientationEnabled && profile?.role === "Tutor" && !profile.orientationCompletedAt) {
    redirect("/orientation");
  }

  const userProfiles = profile?.userId ? getUserProfiles(profile.userId) : Promise.resolve([]);

  return (
    <>
      <DashboardProviders initialProfile={profile}>
        {" "}
        <DashboardLayout
          orientationEnabled={orientationEnabled}
          profile={profile}
          userProfilesPromise={userProfiles}
        >
          {children}
        </DashboardLayout>
      </DashboardProviders>
    </>
  );
}
