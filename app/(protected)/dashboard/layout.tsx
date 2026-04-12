import { cachedGetUser } from "@/lib/actions/user.server.actions";
import DashboardLayout from "@/components/admin/dashboard-layout";
import DashboardProviders from "./dashboardprovider";
import { cachedGetProfile, getUserProfiles } from "@/lib/actions/profile.server.actions";
import { redirect } from "next/navigation";

export const dynamic = 'force-dynamic'

export default async function Layout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await cachedGetUser().catch((error) => {
    console.error("Unable to get user session", error);
    redirect("/");
  });

  if (!user) redirect("/");

  const profile = await cachedGetProfile(user.id);
  const userProfiles = profile?.userId
    ? getUserProfiles(profile.userId)
    : Promise.resolve([]);

  return (
    <>
      <DashboardProviders initialProfile={profile}>
        {" "}
        <DashboardLayout profile={profile} userProfilesPromise = {userProfiles}>{children}</DashboardLayout>
      </DashboardProviders>
    </>
  );
}
