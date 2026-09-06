import { redirect } from "next/navigation";

import DashboardLayout from "@/components/dashboard/dashboard-layout";
import { cachedGetProfile } from "@/lib/actions/cache";
import { getUserProfiles } from "@/lib/actions/profile/server.actions";
import { cachedGetUser } from "@/lib/actions/user/actions";
import {
  canViewTutorOrientation,
  isTutorOrientationEnabled,
} from "@/lib/orientation/config.server";
import DashboardProviders from "../dashboard/dashboardprovider";

export const metadata = {
  title: "Orientation | Connect Me",
  description: "Complete your orientation to access the tutor portal",
};

export const dynamic = "force-dynamic";

export default async function OrientationLayout({ children }: { children: React.ReactNode }) {
  if (!isTutorOrientationEnabled()) redirect("/dashboard");

  const user = await cachedGetUser().catch(() => null);
  if (!user) redirect("/");

  const profile = await cachedGetProfile(user.id);
  if (!profile || !canViewTutorOrientation(profile.role)) redirect("/dashboard");

  const userProfiles = profile.userId ? getUserProfiles(profile.userId) : Promise.resolve([]);

  return (
    <DashboardProviders initialProfile={profile}>
      <DashboardLayout orientationEnabled profile={profile} userProfilesPromise={userProfiles}>
        {children}
      </DashboardLayout>
    </DashboardProviders>
  );
}
